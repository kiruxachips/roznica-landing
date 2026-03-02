"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createPromoCode(data: {
  name: string
  comment?: string
  code: string
  type: string
  value: number
  startDate: string
  endDate: string
  maxUsage?: number | null
  minOrderSum?: number | null
}) {
  const code = data.code.toUpperCase().trim()

  const existing = await prisma.promoCode.findUnique({ where: { code } })
  if (existing) {
    throw new Error("Промокод с таким кодом уже существует")
  }

  const promoCode = await prisma.promoCode.create({
    data: {
      name: data.name,
      comment: data.comment || null,
      code,
      type: data.type,
      value: data.value,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      maxUsage: data.maxUsage ?? null,
      minOrderSum: data.minOrderSum ?? null,
    },
  })

  revalidatePath("/admin/promo-codes")
  return promoCode
}

export async function updatePromoCode(
  id: string,
  data: {
    name?: string
    comment?: string
    code?: string
    type?: string
    value?: number
    startDate?: string
    endDate?: string
    maxUsage?: number | null
    minOrderSum?: number | null
    isActive?: boolean
  }
) {
  const updateData: Record<string, unknown> = {}

  if (data.name !== undefined) updateData.name = data.name
  if (data.comment !== undefined) updateData.comment = data.comment || null
  if (data.code !== undefined) {
    const code = data.code.toUpperCase().trim()
    const existing = await prisma.promoCode.findUnique({ where: { code } })
    if (existing && existing.id !== id) {
      throw new Error("Промокод с таким кодом уже существует")
    }
    updateData.code = code
  }
  if (data.type !== undefined) updateData.type = data.type
  if (data.value !== undefined) updateData.value = data.value
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate)
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate)
  if (data.maxUsage !== undefined) updateData.maxUsage = data.maxUsage
  if (data.minOrderSum !== undefined) updateData.minOrderSum = data.minOrderSum
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  const promoCode = await prisma.promoCode.update({
    where: { id },
    data: updateData,
  })

  revalidatePath("/admin/promo-codes")
  return promoCode
}

export async function deletePromoCode(id: string) {
  const ordersCount = await prisma.order.count({ where: { promoCodeId: id } })
  if (ordersCount > 0) {
    throw new Error("Нельзя удалить промокод, привязанный к заказам")
  }

  await prisma.promoCode.delete({ where: { id } })
  revalidatePath("/admin/promo-codes")
}

export async function togglePromoCodeActive(id: string) {
  const promo = await prisma.promoCode.findUnique({ where: { id } })
  if (!promo) throw new Error("Промокод не найден")

  await prisma.promoCode.update({
    where: { id },
    data: { isActive: !promo.isActive },
  })

  revalidatePath("/admin/promo-codes")
}
