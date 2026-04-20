"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { invalidateSettingsCache } from "@/lib/dal/delivery-settings"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"

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
  const admin = await requireAdmin("delivery.deliveryRules")
  const rule = await prisma.deliveryRule.create({
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
  void logAdminAction({
    admin,
    action: "delivery.rule_created",
    entityType: "delivery_rule",
    entityId: rule.id,
    payload: data,
  })
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
  const admin = await requireAdmin("delivery.deliveryRules")
  await prisma.deliveryRule.update({
    where: { id },
    data,
  })
  invalidateSettingsCache()
  revalidatePath("/admin/delivery")
  void logAdminAction({
    admin,
    action: "delivery.rule_updated",
    entityType: "delivery_rule",
    entityId: id,
    payload: { fields: Object.keys(data) },
  })
}

export async function deleteDeliveryRule(id: string) {
  const admin = await requireAdmin("delivery.deliveryRules")
  await prisma.deliveryRule.delete({ where: { id } })
  invalidateSettingsCache()
  revalidatePath("/admin/delivery")
  void logAdminAction({
    admin,
    action: "delivery.rule_deleted",
    entityType: "delivery_rule",
    entityId: id,
  })
}

export async function toggleDeliveryRule(id: string, isActive: boolean) {
  const admin = await requireAdmin("delivery.deliveryRules")
  await prisma.deliveryRule.update({
    where: { id },
    data: { isActive },
  })
  invalidateSettingsCache()
  revalidatePath("/admin/delivery")
  void logAdminAction({
    admin,
    action: "delivery.rule_toggled",
    entityType: "delivery_rule",
    entityId: id,
    payload: { isActive },
  })
}
