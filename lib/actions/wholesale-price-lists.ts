"use server"

import { revalidatePath, revalidateTag } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"
import { CACHE_TAGS } from "@/lib/cache-tags"

export async function createPriceList(input: {
  name: string
  description?: string
  kind: "fixed" | "discount_pct"
  discountPct?: number | null
  minOrderSum?: number | null
}) {
  const admin = await requireAdmin("wholesale.priceLists.edit")
  if (!input.name.trim()) throw new Error("Укажите название прайс-листа")
  if (input.kind === "discount_pct") {
    const pct = input.discountPct ?? 0
    if (pct <= 0 || pct >= 100) throw new Error("Процент скидки должен быть от 1 до 99")
  }

  const priceList = await prisma.priceList.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      kind: input.kind,
      discountPct: input.kind === "discount_pct" ? input.discountPct ?? null : null,
      minOrderSum: input.minOrderSum ?? null,
      isActive: true,
    },
  })

  void logAdminAction({
    admin,
    action: "wholesale.priceList.created",
    entityType: "price_list",
    entityId: priceList.id,
    payload: { name: priceList.name, kind: priceList.kind },
  })

  revalidatePath("/admin/wholesale/price-lists")
  return priceList
}

export async function updatePriceList(
  id: string,
  patch: {
    name?: string
    description?: string | null
    isActive?: boolean
    kind?: "fixed" | "discount_pct"
    discountPct?: number | null
    minOrderSum?: number | null
  }
) {
  const admin = await requireAdmin("wholesale.priceLists.edit")

  const existing = await prisma.priceList.findUnique({ where: { id } })
  if (!existing) throw new Error("Прайс-лист не найден")

  const updated = await prisma.priceList.update({ where: { id }, data: patch })

  void logAdminAction({
    admin,
    action: "wholesale.priceList.updated",
    entityType: "price_list",
    entityId: id,
    payload: { patch },
  })

  revalidateTag(CACHE_TAGS.wholesaleCatalog(id))
  revalidateTag(CACHE_TAGS.wholesalePriceList(id))
  revalidatePath(`/admin/wholesale/price-lists/${id}`)
  revalidatePath("/admin/wholesale/price-lists")
  return updated
}

export async function deletePriceList(id: string) {
  const admin = await requireAdmin("wholesale.priceLists.delete")

  const usedBy = await prisma.wholesaleCompany.count({ where: { priceListId: id } })
  if (usedBy > 0) {
    throw new Error(`Прайс-лист используется ${usedBy} компаниями. Сначала переназначьте им другой.`)
  }

  await prisma.priceList.delete({ where: { id } })

  void logAdminAction({
    admin,
    action: "wholesale.priceList.deleted",
    entityType: "price_list",
    entityId: id,
  })

  revalidateTag(CACHE_TAGS.wholesaleCatalog(id))
  revalidatePath("/admin/wholesale/price-lists")
}

export async function upsertPriceListItem(input: {
  priceListId: string
  variantId: string
  price: number
  minQuantity?: number
}) {
  const admin = await requireAdmin("wholesale.priceLists.edit")
  if (input.price < 0) throw new Error("Цена не может быть отрицательной")
  const minQuantity = input.minQuantity ?? 1

  const existing = await prisma.priceListItem.findUnique({
    where: {
      priceListId_variantId_minQuantity: {
        priceListId: input.priceListId,
        variantId: input.variantId,
        minQuantity,
      },
    },
  })

  const item = existing
    ? await prisma.priceListItem.update({
        where: { id: existing.id },
        data: { price: input.price },
      })
    : await prisma.priceListItem.create({
        data: {
          priceListId: input.priceListId,
          variantId: input.variantId,
          price: input.price,
          minQuantity,
        },
      })

  void logAdminAction({
    admin,
    action: existing ? "wholesale.priceListItem.updated" : "wholesale.priceListItem.created",
    entityType: "price_list_item",
    entityId: item.id,
    payload: { priceListId: input.priceListId, variantId: input.variantId, price: input.price, minQuantity },
  })

  revalidateTag(CACHE_TAGS.wholesaleCatalog(input.priceListId))
  revalidateTag(CACHE_TAGS.wholesalePriceList(input.priceListId))
  revalidatePath(`/admin/wholesale/price-lists/${input.priceListId}`)
  return item
}

export async function deletePriceListItem(itemId: string) {
  const admin = await requireAdmin("wholesale.priceLists.edit")

  const item = await prisma.priceListItem.findUnique({ where: { id: itemId } })
  if (!item) throw new Error("Позиция прайс-листа не найдена")

  await prisma.priceListItem.delete({ where: { id: itemId } })

  void logAdminAction({
    admin,
    action: "wholesale.priceListItem.deleted",
    entityType: "price_list_item",
    entityId: itemId,
    payload: { priceListId: item.priceListId, variantId: item.variantId },
  })

  revalidateTag(CACHE_TAGS.wholesaleCatalog(item.priceListId))
  revalidatePath(`/admin/wholesale/price-lists/${item.priceListId}`)
}
