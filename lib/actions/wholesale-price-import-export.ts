"use server"

import ExcelJS from "exceljs"
import { revalidatePath, revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"
import { CACHE_TAGS } from "@/lib/cache-tags"

/**
 * Экспортирует прайс-лист в XLSX. Возвращает base64-строку для скачивания
 * через <a download>. В заголовках — SKU, product name, weight, розничная цена,
 * оптовая цена, действие (add / update / skip).
 */
export async function exportPriceListXlsx(priceListId: string): Promise<{
  base64: string
  filename: string
}> {
  await requireAdmin("wholesale.priceLists.view")

  const priceList = await prisma.priceList.findUnique({
    where: { id: priceListId },
    select: { name: true, kind: true, discountPct: true },
  })
  if (!priceList) throw new Error("Прайс-лист не найден")

  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true } },
    orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      weight: true,
      price: true,
      sku: true,
      wholesaleMinQuantity: true,
      product: { select: { name: true, slug: true } },
    },
  })

  const items = await prisma.priceListItem.findMany({
    where: { priceListId },
    select: { variantId: true, price: true, minQuantity: true },
  })
  const byVariant = new Map(items.map((i) => [i.variantId, i]))

  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Millor Coffee"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet(priceList.name.slice(0, 30))
  sheet.columns = [
    { header: "SKU", key: "sku", width: 18 },
    { header: "Товар", key: "product", width: 40 },
    { header: "Фасовка", key: "weight", width: 12 },
    { header: "Розничная цена", key: "retailPrice", width: 16 },
    { header: "Оптовая цена", key: "wholesalePrice", width: 16 },
    { header: "Мин. заказ", key: "minQty", width: 12 },
    { header: "variantId (не редактировать)", key: "variantId", width: 30 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const v of variants) {
    const item = byVariant.get(v.id)
    sheet.addRow({
      sku: v.sku ?? "",
      product: v.product.name,
      weight: v.weight,
      retailPrice: v.price,
      wholesalePrice: item?.price ?? "",
      minQty: item?.minQuantity ?? v.wholesaleMinQuantity ?? 1,
      variantId: v.id,
    })
  }

  // Защищаем variantId колонку от ручного редактирования (логически)
  sheet.getColumn("variantId").eachCell((cell) => {
    cell.protection = { locked: true }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  const base64 = Buffer.from(buffer).toString("base64")
  const safeName = priceList.name.replace(/[^\w\-]/g, "_").slice(0, 40)
  return {
    base64,
    filename: `price-list-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`,
  }
}

/**
 * Импорт CSV с ценами. Строки:
 *   variantId,price,minQuantity
 *   xxx,450,1
 * Альтернативно: sku,price,minQuantity — поиск по SKU.
 * Первая строка — заголовки (игнорируется).
 */
const MAX_CSV_BYTES = 2 * 1024 * 1024 // 2MB — более чем достаточно для ~10k SKU
const MAX_CSV_ROWS = 10_000

export async function importPriceListCsv(
  priceListId: string,
  csvContent: string
): Promise<{
  created: number
  updated: number
  errors: { line: number; reason: string }[]
}> {
  const admin = await requireAdmin("wholesale.priceLists.edit")

  // DoS protection: ограничение по байтам и строкам до парсинга.
  if (csvContent.length > MAX_CSV_BYTES) {
    throw new Error(`CSV слишком большой (>${Math.round(MAX_CSV_BYTES / 1024 / 1024)}MB)`)
  }

  const priceList = await prisma.priceList.findUnique({ where: { id: priceListId } })
  if (!priceList) throw new Error("Прайс-лист не найден")

  const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) {
    return { created: 0, updated: 0, errors: [{ line: 0, reason: "Пустой CSV" }] }
  }
  if (lines.length > MAX_CSV_ROWS) {
    throw new Error(`Слишком много строк (>${MAX_CSV_ROWS})`)
  }

  const headerParts = lines[0].split(",").map((s) => s.trim().toLowerCase())
  const idxVariantId = headerParts.findIndex((h) => h === "variantid" || h === "variant_id")
  const idxSku = headerParts.findIndex((h) => h === "sku" || h === "артикул")
  const idxPrice = headerParts.findIndex((h) => h === "price" || h === "цена" || h === "оптовая цена")
  const idxMinQty = headerParts.findIndex((h) => h === "minquantity" || h === "мин. заказ" || h === "min_qty")

  if (idxPrice === -1 || (idxVariantId === -1 && idxSku === -1)) {
    return {
      created: 0,
      updated: 0,
      errors: [
        {
          line: 0,
          reason:
            "Нужны колонки: (variantId или sku) и price. Заголовки в первой строке.",
        },
      ],
    }
  }

  const errors: { line: number; reason: string }[] = []
  let created = 0
  let updated = 0

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((s) => s.trim())
    const rawVariantId = idxVariantId !== -1 ? parts[idxVariantId] : null
    const rawSku = idxSku !== -1 ? parts[idxSku] : null
    const rawPrice = parts[idxPrice]
    const rawMinQty = idxMinQty !== -1 ? parts[idxMinQty] : "1"

    const price = Number(rawPrice)
    if (!Number.isFinite(price) || price < 0) {
      errors.push({ line: i + 1, reason: `Некорректная цена: "${rawPrice}"` })
      continue
    }
    const minQuantity = Math.max(1, Number(rawMinQty) || 1)

    // Находим вариант
    let variantId: string | null = rawVariantId || null
    if (!variantId && rawSku) {
      const found = await prisma.productVariant.findFirst({
        where: { sku: rawSku, isActive: true },
        select: { id: true },
      })
      variantId = found?.id ?? null
    }
    if (!variantId) {
      errors.push({ line: i + 1, reason: "Не найден variantId/SKU" })
      continue
    }

    const exists = await prisma.productVariant.findUnique({ where: { id: variantId } })
    if (!exists) {
      errors.push({ line: i + 1, reason: `variantId=${variantId} не найден` })
      continue
    }

    // Если price пустой — пропускаем (юзер оставил ячейку пустой)
    if (!rawPrice) continue

    const existing = await prisma.priceListItem.findUnique({
      where: {
        priceListId_variantId_minQuantity: {
          priceListId,
          variantId,
          minQuantity,
        },
      },
    })
    if (existing) {
      if (existing.price !== price) {
        await prisma.priceListItem.update({
          where: { id: existing.id },
          data: { price },
        })
        updated++
      }
    } else {
      await prisma.priceListItem.create({
        data: { priceListId, variantId, price, minQuantity },
      })
      created++
    }
  }

  void logAdminAction({
    admin,
    action: "wholesale.priceList.imported_csv",
    entityType: "price_list",
    entityId: priceListId,
    payload: { created, updated, errors: errors.length },
  })

  revalidateTag(CACHE_TAGS.wholesaleCatalog(priceListId))
  revalidateTag(CACHE_TAGS.wholesalePriceList(priceListId))
  revalidatePath(`/admin/wholesale/price-lists/${priceListId}`)

  return { created, updated, errors }
}
