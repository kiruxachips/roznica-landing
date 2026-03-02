"use server"

import { prisma } from "@/lib/prisma"
import { invalidateSettingsCache } from "@/lib/dal/delivery-settings"
import { testCdekConnection as testCdek } from "@/lib/delivery/cdek"
import { revalidatePath } from "next/cache"

export async function updateDeliverySettings(data: Record<string, string>) {
  for (const [key, value] of Object.entries(data)) {
    await prisma.deliverySetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  }

  invalidateSettingsCache()
  revalidatePath("/admin/delivery")
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
  await prisma.deliveryMarkupRule.create({
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
  await prisma.deliveryMarkupRule.update({
    where: { id },
    data,
  })

  revalidatePath("/admin/delivery")
}

export async function deleteMarkupRule(id: string) {
  await prisma.deliveryMarkupRule.delete({ where: { id } })
  revalidatePath("/admin/delivery")
}

export async function testCdekConnection(
  clientId: string,
  clientSecret: string,
  testMode: boolean
) {
  return testCdek(clientId, clientSecret, testMode)
}
