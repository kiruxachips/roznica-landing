import { prisma } from "@/lib/prisma"

/**
 * Pricing engine — ЕДИНСТВЕННАЯ функция расчёта цены для любого канала.
 *
 * КРИТИЧНО: никогда не читай `variant.price` напрямую в коде, который
 * может рендериться для оптового клиента. Всегда через resolvePrice(s).
 *
 * Защита от утечки оптовых цен в розницу:
 *   - без ctx или с ctx.channel="retail" всегда возвращается розничная цена
 *   - оптовые данные применяются только при ctx.channel="wholesale" + priceListId
 */

export interface PriceContext {
  channel: "retail" | "wholesale"
  priceListId?: string | null
  companyId?: string
}

export interface ResolvedPrice {
  price: number
  oldPrice: number | null
  discountPct: number | null
  minQuantity: number
  source: "retail" | "pricelist_item" | "pricelist_discount" | "retail_fallback"
}

export const RETAIL_CONTEXT: PriceContext = { channel: "retail" }

function retailResolve(variant: { price: number; oldPrice: number | null }): ResolvedPrice {
  const discountPct =
    variant.oldPrice && variant.oldPrice > variant.price
      ? Math.round(((variant.oldPrice - variant.price) / variant.oldPrice) * 100)
      : null
  return {
    price: variant.price,
    oldPrice: variant.oldPrice,
    discountPct,
    minQuantity: 1,
    source: "retail",
  }
}

/**
 * Одна цена за вариант в заданном контексте.
 *
 * Сценарии:
 *   retail              → variant.price (+ oldPrice)
 *   wholesale, нет priceList → retail fallback
 *   wholesale, priceList=fixed, item есть  → item.price
 *   wholesale, priceList=fixed, item нет   → retail fallback
 *   wholesale, priceList=discount_pct, item есть → item.price (item имеет приоритет)
 *   wholesale, priceList=discount_pct, item нет  → variant.price * (1 - pct/100)
 */
export async function resolvePrice(
  variantId: string,
  ctx: PriceContext = RETAIL_CONTEXT
): Promise<ResolvedPrice | null> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, price: true, oldPrice: true, wholesaleMinQuantity: true },
  })
  if (!variant) return null

  if (ctx.channel === "retail" || !ctx.priceListId) {
    return retailResolve(variant)
  }

  const priceList = await prisma.priceList.findUnique({
    where: { id: ctx.priceListId },
    select: { id: true, isActive: true, kind: true, discountPct: true },
  })
  if (!priceList || !priceList.isActive) {
    return retailResolve(variant)
  }

  // Ищем override для этого варианта
  const item = await prisma.priceListItem.findFirst({
    where: { priceListId: ctx.priceListId, variantId, minQuantity: 1 },
    select: { price: true, minQuantity: true },
  })

  if (item) {
    return {
      price: item.price,
      oldPrice: variant.price > item.price ? variant.price : null,
      discountPct:
        variant.price > item.price
          ? Math.round(((variant.price - item.price) / variant.price) * 100)
          : null,
      minQuantity: Math.max(item.minQuantity, variant.wholesaleMinQuantity ?? 1),
      source: "pricelist_item",
    }
  }

  if (priceList.kind === "discount_pct" && priceList.discountPct && priceList.discountPct > 0) {
    const price = Math.round(variant.price * (1 - priceList.discountPct / 100))
    return {
      price,
      oldPrice: variant.price,
      discountPct: priceList.discountPct,
      minQuantity: variant.wholesaleMinQuantity ?? 1,
      source: "pricelist_discount",
    }
  }

  return { ...retailResolve(variant), source: "retail_fallback" }
}

/**
 * Батч-расчёт цен для каталога. Один запрос в Prisma для вариантов, один — для PriceListItem.
 * Возвращает Map variantId → ResolvedPrice.
 *
 * Использовать ВСЕГДА когда рендеришь список товаров — один запрос вместо N.
 */
export async function resolvePrices(
  variantIds: string[],
  ctx: PriceContext = RETAIL_CONTEXT
): Promise<Map<string, ResolvedPrice>> {
  const result = new Map<string, ResolvedPrice>()
  if (variantIds.length === 0) return result

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, price: true, oldPrice: true, wholesaleMinQuantity: true },
  })

  if (ctx.channel === "retail" || !ctx.priceListId) {
    for (const v of variants) {
      result.set(v.id, retailResolve(v))
    }
    return result
  }

  const priceList = await prisma.priceList.findUnique({
    where: { id: ctx.priceListId },
    select: { id: true, isActive: true, kind: true, discountPct: true },
  })

  if (!priceList || !priceList.isActive) {
    for (const v of variants) {
      result.set(v.id, retailResolve(v))
    }
    return result
  }

  const items = await prisma.priceListItem.findMany({
    where: { priceListId: ctx.priceListId, variantId: { in: variantIds }, minQuantity: 1 },
    select: { variantId: true, price: true, minQuantity: true },
  })
  const byVariant = new Map(items.map((i) => [i.variantId, i]))

  for (const v of variants) {
    const item = byVariant.get(v.id)
    if (item) {
      result.set(v.id, {
        price: item.price,
        oldPrice: v.price > item.price ? v.price : null,
        discountPct:
          v.price > item.price
            ? Math.round(((v.price - item.price) / v.price) * 100)
            : null,
        minQuantity: Math.max(item.minQuantity, v.wholesaleMinQuantity ?? 1),
        source: "pricelist_item",
      })
      continue
    }
    if (priceList.kind === "discount_pct" && priceList.discountPct && priceList.discountPct > 0) {
      const price = Math.round(v.price * (1 - priceList.discountPct / 100))
      result.set(v.id, {
        price,
        oldPrice: v.price,
        discountPct: priceList.discountPct,
        minQuantity: v.wholesaleMinQuantity ?? 1,
        source: "pricelist_discount",
      })
      continue
    }
    result.set(v.id, { ...retailResolve(v), source: "retail_fallback" })
  }

  return result
}
