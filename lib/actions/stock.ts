"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { adjustStock, adjustStockBatch, type StockReason } from "@/lib/dal/stock"
import { notifyStockChange, notifyStockChanges } from "@/lib/integrations/stock-alerts"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"

export async function adjustStockAction(input: {
  variantId: string
  delta: number
  reason: StockReason
  notes?: string
}) {
  const admin = await requireAdmin("stock.adjust")
  const result = await adjustStock({
    variantId: input.variantId,
    delta: input.delta,
    reason: input.reason,
    notes: input.notes,
    changedBy: admin.userId,
  })
  void notifyStockChange(result)
  void logAdminAction({
    admin,
    action: "stock.adjusted",
    entityType: "variant",
    entityId: input.variantId,
    payload: { delta: input.delta, reason: input.reason, notes: input.notes },
  })

  revalidatePath("/admin/warehouse")
  revalidatePath("/admin/products")
  revalidatePath("/catalog")
  return result
}

export async function bulkIntakeAction(
  items: Array<{ variantId: string; delta: number; notes?: string }>
) {
  const admin = await requireAdmin("stock.adjust")
  const filtered = items.filter((i) => i.delta !== 0)
  if (filtered.length === 0) return []

  const results = await adjustStockBatch(
    filtered.map((i) => ({
      variantId: i.variantId,
      delta: i.delta,
      reason: "supplier_received" as StockReason,
      notes: i.notes,
      changedBy: admin.userId,
    }))
  )
  void notifyStockChanges(results)
  void logAdminAction({
    admin,
    action: "stock.bulk_intake",
    payload: { count: filtered.length, totalDelta: filtered.reduce((s, i) => s + i.delta, 0) },
  })

  revalidatePath("/admin/warehouse")
  revalidatePath("/admin/products")
  revalidatePath("/catalog")
  return results
}

export async function setLowThresholdAction(variantId: string, threshold: number | null) {
  const admin = await requireAdmin("stock.setThreshold")
  await prisma.productVariant.update({
    where: { id: variantId },
    data: { lowStockThreshold: threshold },
  })
  void logAdminAction({
    admin,
    action: "stock.threshold_set",
    entityType: "variant",
    entityId: variantId,
    payload: { threshold },
  })
  revalidatePath("/admin/warehouse")
  revalidatePath("/admin/products")
}
