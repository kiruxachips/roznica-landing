"use server"

import { createShipmentForOrder, refreshTrackingForOrder } from "@/lib/delivery/shipment"
import { calculateDeliveryRates, buildPackagePlan, type ItemToPack } from "@/lib/delivery"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"
import { revalidatePath } from "next/cache"

export async function createShipmentManual(
  orderId: string,
  senderLocationIndex?: number
) {
  const admin = await requireAdmin("orders.createShipment")
  try {
    await createShipmentForOrder(orderId, senderLocationIndex)
    revalidatePath(`/admin/orders/${orderId}`)
    void logAdminAction({
      admin,
      action: "order.shipment_created",
      entityType: "order",
      entityId: orderId,
      payload: { senderLocationIndex },
    })
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
  }
}

export async function refreshTracking(orderId: string) {
  const admin = await requireAdmin("orders.refreshTracking")
  try {
    const statuses = await refreshTrackingForOrder(orderId)
    revalidatePath(`/admin/orders/${orderId}`)
    void logAdminAction({
      admin,
      action: "order.tracking_refreshed",
      entityType: "order",
      entityId: orderId,
    })
    return { success: true, statuses }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
  }
}

/**
 * Тестовый расчёт тарифов из админки — не создаёт заказа, просто вызывает
 * калькулятор с переданными параметрами. Возвращает все тарифы + план упаковки.
 */
export async function testCalculateDelivery(params: {
  cityCode?: string
  postalCode?: string
  city?: string
  region?: string
  items: ItemToPack[]
  cartTotal?: number
}) {
  // Доступ к тестовому калькулятору — только админу (находится в делиш-настройках).
  try {
    await requireAdmin("delivery.settings")
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Нет доступа" }
  }
  try {
    const [rates, plan] = await Promise.all([
      calculateDeliveryRates({
        toCityCode: params.cityCode,
        toPostalCode: params.postalCode,
        toCity: params.city,
        toRegion: params.region,
        items: params.items,
        cartTotal: params.cartTotal,
      }),
      buildPackagePlan(params.items),
    ])
    return { success: true, rates, plan }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
  }
}
