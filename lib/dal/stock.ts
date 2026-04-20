import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

/**
 * Единая точка изменения остатков товаров на складе.
 *
 * Гарантии:
 * - Атомарность: операция выполняется внутри транзакции с блокировкой строки.
 * - История: каждое изменение фиксируется в StockHistory с причиной.
 * - Защита от отрицательного остатка: при delta < 0 проверяется stock + delta >= 0.
 * - Возвращает маркеры пересечения порогов (для уведомлений в миллорбот — вызывается СНАРУЖИ,
 *   после commit транзакции, чтобы не отправить событие, когда транзакция откатится).
 */

export type StockReason =
  | "order_placed"          // декремент при создании заказа
  | "order_cancelled"       // инкремент при отмене заказа
  | "order_restored"        // декремент при возврате отменённого в работу (cancelled→pending)
  | "supplier_received"     // приход от поставщика (менеджер в админке)
  | "inventory_correction"  // ручная коррекция менеджером
  | "write_off"             // списание (брак, потеря)

export interface StockAdjustInput {
  variantId: string
  delta: number                 // +N приход / -N списание
  reason: StockReason
  orderId?: string
  notes?: string
  changedBy?: string            // AdminUser.id | "customer" | "system"
}

export interface StockAdjustResult {
  variantId: string
  stockBefore: number
  stockAfter: number
  /** true если stock перешёл границу lowStockThreshold сверху вниз (и threshold ≠ null) */
  crossedLowThreshold: boolean
  /** true если stock стал 0 (был > 0) */
  becameDepleted: boolean
  /** true если stock стал > 0 (был 0) — для возможных будущих сценариев */
  recovered: boolean
}

/**
 * Безопасное изменение остатка одного варианта. Может выполняться как standalone, так и встраиваться в внешнюю транзакцию.
 *
 * ВАЖНО: функция не кидает события в outbox. Это ответственность вызывающего —
 * после commit транзакции вызвать `notifyStockChange(result, variant)` из `lib/integrations/stock-alerts.ts`.
 * Это предотвращает отправку уведомлений при откате транзакции.
 */
export async function adjustStock(
  input: StockAdjustInput,
  tx?: Prisma.TransactionClient
): Promise<StockAdjustResult> {
  const run = async (client: Prisma.TransactionClient) => {
    // Блокируем строку варианта, чтобы конкурентный запрос не прочитал устаревший stock.
    // SELECT ... FOR UPDATE в Postgres — через $queryRaw.
    const rows = await client.$queryRaw<
      Array<{ id: string; stock: number; lowStockThreshold: number | null }>
    >`SELECT id, stock, "lowStockThreshold" FROM "ProductVariant" WHERE id = ${input.variantId} FOR UPDATE`

    if (rows.length === 0) {
      throw new Error(`adjustStock: вариант ${input.variantId} не найден`)
    }
    const { stock: stockBefore, lowStockThreshold } = rows[0]
    const stockAfter = stockBefore + input.delta

    if (stockAfter < 0) {
      throw new Error(
        `Недостаточно на складе: ${stockBefore} + (${input.delta}) < 0`
      )
    }

    await client.productVariant.update({
      where: { id: input.variantId },
      data: { stock: stockAfter },
    })

    await client.stockHistory.create({
      data: {
        variantId: input.variantId,
        delta: input.delta,
        stockBefore,
        stockAfter,
        reason: input.reason,
        orderId: input.orderId,
        notes: input.notes,
        changedBy: input.changedBy,
      },
    })

    const crossedLowThreshold =
      lowStockThreshold !== null &&
      stockBefore > lowStockThreshold &&
      stockAfter <= lowStockThreshold

    const becameDepleted = stockBefore > 0 && stockAfter === 0
    const recovered = stockBefore === 0 && stockAfter > 0

    return {
      variantId: input.variantId,
      stockBefore,
      stockAfter,
      crossedLowThreshold,
      becameDepleted,
      recovered,
    }
  }

  if (tx) {
    return run(tx)
  }
  return prisma.$transaction(run)
}

/**
 * Пакетное изменение остатков — например, массовый приход поставки.
 * Выполняется в одной транзакции; если хоть один вариант не прошёл, весь батч откатывается.
 */
export async function adjustStockBatch(
  inputs: StockAdjustInput[],
  tx?: Prisma.TransactionClient
): Promise<StockAdjustResult[]> {
  const run = async (client: Prisma.TransactionClient) => {
    const results: StockAdjustResult[] = []
    for (const input of inputs) {
      results.push(await adjustStock(input, client))
    }
    return results
  }
  if (tx) return run(tx)
  return prisma.$transaction(run)
}

/**
 * Снимок склада для дашборда: список вариантов с текущим остатком и статусом.
 */
export interface StockSnapshotRow {
  variantId: string
  productId: string
  productName: string
  productSlug: string
  productIsActive: boolean
  variantWeight: string
  variantSku: string | null
  variantIsActive: boolean
  stock: number
  lowStockThreshold: number | null
  status: "in_stock" | "low" | "out"
  lastChangeAt: Date | null
}

export interface StockSnapshotFilters {
  status?: "in_stock" | "low" | "out" | "all"
  search?: string
  categoryId?: string
}

export async function getStockSnapshot(
  filters: StockSnapshotFilters = {}
): Promise<StockSnapshotRow[]> {
  const where: Prisma.ProductVariantWhereInput = {}
  if (filters.search) {
    where.OR = [
      { product: { name: { contains: filters.search, mode: "insensitive" } } },
      { sku: { contains: filters.search, mode: "insensitive" } },
    ]
  }
  if (filters.categoryId) {
    where.product = { ...(where.product as object), categoryId: filters.categoryId }
  }

  const variants = await prisma.productVariant.findMany({
    where,
    select: {
      id: true,
      weight: true,
      sku: true,
      stock: true,
      lowStockThreshold: true,
      isActive: true,
      product: {
        select: { id: true, name: true, slug: true, isActive: true },
      },
      stockHistory: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
    orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }],
  })

  const mapped: StockSnapshotRow[] = variants.map((v) => {
    let status: "in_stock" | "low" | "out" = "in_stock"
    if (v.stock <= 0) status = "out"
    else if (v.lowStockThreshold !== null && v.stock <= v.lowStockThreshold) status = "low"

    return {
      variantId: v.id,
      productId: v.product.id,
      productName: v.product.name,
      productSlug: v.product.slug,
      productIsActive: v.product.isActive,
      variantWeight: v.weight,
      variantSku: v.sku,
      variantIsActive: v.isActive,
      stock: v.stock,
      lowStockThreshold: v.lowStockThreshold,
      status,
      lastChangeAt: v.stockHistory[0]?.createdAt ?? null,
    }
  })

  if (filters.status && filters.status !== "all") {
    return mapped.filter((r) => r.status === filters.status)
  }
  return mapped
}

/**
 * История изменений остатка одного варианта.
 */
export async function getStockHistory(variantId: string, limit = 50) {
  return prisma.stockHistory.findMany({
    where: { variantId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
}

/**
 * Метрики для главной дашборды.
 */
export async function getStockMetrics() {
  const [total, outOfStock, recentIntakes] = await Promise.all([
    prisma.productVariant.aggregate({
      where: { isActive: true, product: { isActive: true } },
      _sum: { stock: true },
      _count: true,
    }),
    prisma.productVariant.count({
      where: { isActive: true, product: { isActive: true }, stock: { lte: 0 } },
    }),
    prisma.stockHistory.count({
      where: {
        reason: "supplier_received",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ])

  // Low stock точный счётчик: stock > 0 AND stock <= lowStockThreshold — требует raw SQL
  const lowStockExact = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "ProductVariant" pv
    JOIN "Product" p ON pv."productId" = p.id
    WHERE pv."isActive" = true
      AND p."isActive" = true
      AND pv.stock > 0
      AND pv."lowStockThreshold" IS NOT NULL
      AND pv.stock <= pv."lowStockThreshold"
  `
  const lowStockCount = Number(lowStockExact[0]?.count ?? 0)

  return {
    totalVariants: total._count,
    totalStock: total._sum.stock ?? 0,
    outOfStock,
    lowStock: lowStockCount,
    intakesLast7Days: recentIntakes,
  }
}
