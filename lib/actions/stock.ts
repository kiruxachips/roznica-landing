"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { adjustStock, adjustStockBatch, type StockReason } from "@/lib/dal/stock"
import { notifyStockChange, notifyStockChanges } from "@/lib/integrations/stock-alerts"

async function getAdminId(): Promise<string> {
  const session = await auth()
  const userType = (session?.user as { userType?: string } | undefined)?.userType
  if (!session?.user?.id || userType !== "admin") {
    throw new Error("Нет доступа")
  }
  return session.user.id
}

export async function adjustStockAction(input: {
  variantId: string
  delta: number
  reason: StockReason
  notes?: string
}) {
  const adminId = await getAdminId()
  const result = await adjustStock({
    variantId: input.variantId,
    delta: input.delta,
    reason: input.reason,
    notes: input.notes,
    changedBy: adminId,
  })
  void notifyStockChange(result)

  revalidatePath("/admin/warehouse")
  revalidatePath("/admin/products")
  revalidatePath("/catalog")
  return result
}

export async function bulkIntakeAction(
  items: Array<{ variantId: string; delta: number; notes?: string }>
) {
  const adminId = await getAdminId()
  const filtered = items.filter((i) => i.delta !== 0)
  if (filtered.length === 0) return []

  const results = await adjustStockBatch(
    filtered.map((i) => ({
      variantId: i.variantId,
      delta: i.delta,
      reason: "supplier_received" as StockReason,
      notes: i.notes,
      changedBy: adminId,
    }))
  )
  void notifyStockChanges(results)

  revalidatePath("/admin/warehouse")
  revalidatePath("/admin/products")
  revalidatePath("/catalog")
  return results
}

export async function setLowThresholdAction(variantId: string, threshold: number | null) {
  await getAdminId()
  await prisma.productVariant.update({
    where: { id: variantId },
    data: { lowStockThreshold: threshold },
  })
  revalidatePath("/admin/warehouse")
  revalidatePath("/admin/products")
}
