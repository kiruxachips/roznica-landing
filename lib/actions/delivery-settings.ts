"use server"

import { prisma } from "@/lib/prisma"
import { invalidateSettingsCache } from "@/lib/dal/delivery-settings"
import { testCdekConnection as testCdek } from "@/lib/delivery/cdek"
import { revalidatePath } from "next/cache"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"

export async function updateDeliverySettings(data: Record<string, string>) {
  const admin = await requireAdmin("delivery.settings")
  for (const [key, value] of Object.entries(data)) {
    await prisma.deliverySetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  }

  invalidateSettingsCache()
  revalidatePath("/admin/delivery")
  void logAdminAction({
    admin,
    action: "delivery.settings_updated",
    entityType: "delivery_setting",
    payload: { keys: Object.keys(data) },
  })
}

export async function createMarkupRule(data: {
  name: string
  carrier: string
  type: string
  value: number
  minWeight?: number
  maxWeight?: number
  minPrice?: number
  isActive?: boolean
  sortOrder?: number
}) {
  const admin = await requireAdmin("delivery.markupRules")
  const rule = await prisma.deliveryMarkupRule.create({
    data: {
      name: data.name,
      carrier: data.carrier,
      type: data.type,
      value: data.value,
      minWeight: data.minWeight || null,
      maxWeight: data.maxWeight || null,
      minPrice: data.minPrice || null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  })

  revalidatePath("/admin/delivery")
  void logAdminAction({
    admin,
    action: "delivery.markup_created",
    entityType: "markup_rule",
    entityId: rule.id,
    payload: { name: data.name, carrier: data.carrier, type: data.type, value: data.value },
  })
}

export async function updateMarkupRule(
  id: string,
  data: {
    name?: string
    carrier?: string
    type?: string
    value?: number
    minWeight?: number | null
    maxWeight?: number | null
    minPrice?: number | null
    isActive?: boolean
    sortOrder?: number
  }
) {
  const admin = await requireAdmin("delivery.markupRules")
  await prisma.deliveryMarkupRule.update({
    where: { id },
    data,
  })

  revalidatePath("/admin/delivery")
  void logAdminAction({
    admin,
    action: "delivery.markup_updated",
    entityType: "markup_rule",
    entityId: id,
    payload: { fields: Object.keys(data) },
  })
}

export async function deleteMarkupRule(id: string) {
  const admin = await requireAdmin("delivery.markupRules")
  await prisma.deliveryMarkupRule.delete({ where: { id } })
  revalidatePath("/admin/delivery")
  void logAdminAction({
    admin,
    action: "delivery.markup_deleted",
    entityType: "markup_rule",
    entityId: id,
  })
}

export async function testCdekConnection(
  clientId: string,
  clientSecret: string,
  testMode: boolean
) {
  await requireAdmin("delivery.settings")
  return testCdek(clientId, clientSecret, testMode)
}
