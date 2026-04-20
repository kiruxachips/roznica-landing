"use server"

import { createShipmentForOrder, refreshTrackingForOrder } from "@/lib/delivery/shipment"
import { calculateDeliveryRates, buildPackagePlan, type ItemToPack } from "@/lib/delivery"
import { auth } from "@/lib/auth"
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
  const session = await auth()
  const userType = (session?.user as { userType?: string } | undefined)?.userType
  if (!session?.user?.id || userType !== "admin") {
    return { success: false, error: "Нет доступа" }
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
