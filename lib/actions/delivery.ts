"use server"

import { createShipmentForOrder, refreshTrackingForOrder } from "@/lib/delivery/shipment"
import { revalidatePath } from "next/cache"

export async function createShipmentManual(
  orderId: string,
  senderLocationIndex?: number
) {
  try {
    await createShipmentForOrder(orderId, senderLocationIndex)
    revalidatePath(`/admin/orders/${orderId}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
  }
}

export async function refreshTracking(orderId: string) {
  try {
    const statuses = await refreshTrackingForOrder(orderId)
    revalidatePath(`/admin/orders/${orderId}`)
    return { success: true, statuses }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
  }
}
