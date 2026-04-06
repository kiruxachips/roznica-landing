"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { invalidateSettingsCache } from "@/lib/dal/delivery-settings"

export async function createDeliveryRule(data: {
  name: string
  carrier: string
  deliveryType?: string
  minCartTotal?: number
  maxDeliveryPrice?: number
  city?: string
  action: string
  discountAmount?: number
}) {
  await prisma.deliveryRule.create({
    data: {
      name: data.name,
      carrier: data.carrier,
      deliveryType: data.deliveryType || null,
      minCartTotal: data.minCartTotal || null,
      maxDeliveryPrice: data.maxDeliveryPrice || null,
      city: data.city || null,
      action: data.action,
      discountAmount: data.discountAmount || null,
      isActive: true,
    },
  })
  invalidateSettingsCache()
  revalidatePath("/admin/delivery")
}

export async function updateDeliveryRule(
  id: string,
  data: {
    name?: string
    carrier?: string
    deliveryType?: string | null
    minCartTotal?: number | null
    maxDeliveryPrice?: number | null
    city?: string | null
    action?: string
    discountAmount?: number | null
    isActive?: boolean
    sortOrder?: number
  }
) {
  await prisma.deliveryRule.update({
    where: { id },
    data,
  })
  invalidateSettingsCache()
  revalidatePath("/admin/delivery")
}

export async function deleteDeliveryRule(id: string) {
  await prisma.deliveryRule.delete({ where: { id } })
  invalidateSettingsCache()
  revalidatePath("/admin/delivery")
}

export async function toggleDeliveryRule(id: string, isActive: boolean) {
  await prisma.deliveryRule.update({
    where: { id },
    data: { isActive },
  })
  invalidateSettingsCache()
  revalidatePath("/admin/delivery")
}
