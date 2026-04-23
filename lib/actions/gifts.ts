"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, revalidateTag } from "next/cache"
import { CACHE_TAGS } from "@/lib/cache-tags"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"
import { getStorage } from "@/lib/storage"
import { validateImageMagicBytes } from "@/lib/image-validation"
import { invalidateSettingsCache } from "@/lib/dal/delivery-settings"

function invalidate() {
  revalidateTag(CACHE_TAGS.gifts)
  revalidatePath("/admin/gifts")
  // DeliverySetting кэш in-memory 60 сек — без явной инвалидации toggle
  // kill-switch был бы виден клиенту не сразу. areGiftsEnabled() и
  // getMinGiftThreshold() читают через getDeliverySettings.
  invalidateSettingsCache()
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024

export async function createGift(input: {
  name: string
  description?: string
  minCartTotal: number
  stock?: number | null
  isActive?: boolean
  sortOrder?: number
  /** Опциональный линк на вариант товара — stock берётся из него,
   *  при выдаче декрементится ProductVariant.stock через adjustStock. */
  productVariantId?: string | null
}) {
  const admin = await requireAdmin("gifts.edit")
  if (!input.name.trim()) throw new Error("Укажите название подарка")
  if (!Number.isFinite(input.minCartTotal) || input.minCartTotal < 0) {
    throw new Error("Некорректный порог стоимости")
  }

  // Если линкуем — проверяем что вариант существует
  if (input.productVariantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: input.productVariantId },
      select: { id: true },
    })
    if (!variant) throw new Error("Выбранный вариант товара не найден")
  }

  const gift = await prisma.gift.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      minCartTotal: Math.floor(input.minCartTotal),
      // Для linked-gift Gift.stock всегда null — stock читается из ProductVariant.stock
      stock: input.productVariantId
        ? null
        : input.stock === null
          ? null
          : input.stock !== undefined
            ? input.stock
            : null,
      isActive: input.isActive ?? true,
      sortOrder: input.sortOrder ?? 0,
      productVariantId: input.productVariantId || null,
    },
  })

  void logAdminAction({
    admin,
    action: "gift.created",
    entityType: "gift",
    entityId: gift.id,
    payload: { name: gift.name, minCartTotal: gift.minCartTotal, linked: !!input.productVariantId },
  })
  invalidate()
  return gift
}

export async function updateGift(
  id: string,
  input: Partial<{
    name: string
    description: string | null
    minCartTotal: number
    stock: number | null
    isActive: boolean
    sortOrder: number
    productVariantId: string | null
  }>
) {
  const admin = await requireAdmin("gifts.edit")

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) {
    if (!input.name.trim()) throw new Error("Укажите название подарка")
    data.name = input.name.trim()
  }
  if (input.description !== undefined) data.description = input.description?.trim() || null
  if (input.minCartTotal !== undefined) {
    if (!Number.isFinite(input.minCartTotal) || input.minCartTotal < 0) {
      throw new Error("Некорректный порог стоимости")
    }
    data.minCartTotal = Math.floor(input.minCartTotal)
  }
  if (input.stock !== undefined) data.stock = input.stock
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder
  if (input.productVariantId !== undefined) {
    if (input.productVariantId) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: input.productVariantId },
        select: { id: true },
      })
      if (!variant) throw new Error("Выбранный вариант товара не найден")
      data.productVariantId = input.productVariantId
      // При установке линка обнуляем собственный stock — это маркер
      // «идёт с ProductVariant»
      data.stock = null
    } else {
      data.productVariantId = null
    }
  }

  const gift = await prisma.gift.update({ where: { id }, data })
  void logAdminAction({
    admin,
    action: "gift.updated",
    entityType: "gift",
    entityId: id,
    payload: { fields: Object.keys(data) },
  })
  invalidate()
  return gift
}

/**
 * Soft-delete подарка: isActive=false. Физически не удаляем, т.к. на
 * исторических заказах стоит FK (SetNull при delete, но терять имя
 * "какой подарок клали" — жаль). Для полного удаления — SQL-руками.
 */
export async function archiveGift(id: string) {
  const admin = await requireAdmin("gifts.delete")
  await prisma.gift.update({ where: { id }, data: { isActive: false } })
  void logAdminAction({
    admin,
    action: "gift.archived",
    entityType: "gift",
    entityId: id,
  })
  invalidate()
}

/**
 * Переключение глобального kill-switch программы подарков.
 * Пишет DeliverySetting.gifts_enabled — читается через areGiftsEnabled()
 * во всех gift-endpoint'ах и createOrder. UI в /admin/gifts видит эффект
 * сразу (delivery-settings кэш 60 сек).
 */
export async function setGiftsEnabled(enabled: boolean) {
  const admin = await requireAdmin("gifts.edit")
  const value = enabled ? "true" : "false"
  await prisma.deliverySetting.upsert({
    where: { key: "gifts_enabled" },
    update: { value },
    create: { key: "gifts_enabled", value },
  })
  void logAdminAction({
    admin,
    action: enabled ? "gift.program_enabled" : "gift.program_disabled",
    entityType: "gift_program",
    entityId: "global",
  })
  invalidate()
}

export async function uploadGiftImage(formData: FormData) {
  await requireAdmin("gifts.edit")
  const file = formData.get("file") as File
  const giftId = formData.get("giftId") as string
  const alt = ((formData.get("alt") as string) || "").trim()

  if (!file || !giftId) throw new Error("Файл и ID подарка обязательны")
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`Файл больше ${MAX_IMAGE_SIZE / 1024 / 1024} МБ`)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const magic = validateImageMagicBytes(buffer)
  if (!magic.ok) throw new Error("Файл не является изображением (JPEG/PNG/WebP/GIF)")

  const storage = getStorage()
  const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
  const url = await storage.save(buffer, filename, giftId, "gifts")

  // Удаляем старую картинку если была
  const existing = await prisma.gift.findUnique({ where: { id: giftId } })
  if (existing?.imageUrl && existing.imageUrl !== url) {
    await storage.delete(existing.imageUrl).catch(() => { /* ok */ })
  }

  await prisma.gift.update({
    where: { id: giftId },
    data: { imageUrl: url, imageAlt: alt || null },
  })
  invalidate()
  return { url }
}
