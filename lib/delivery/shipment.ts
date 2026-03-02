import { prisma } from "@/lib/prisma"
import { getDeliverySettings } from "@/lib/dal/delivery-settings"
import { createCdekProvider } from "./cdek"
import { createPochtaProvider } from "./pochta"
import type { CreateShipmentRequest } from "./types"

export async function createShipmentForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })

  if (!order) throw new Error("Order not found")
  if (order.carrierOrderId) return // Already created
  if (!order.deliveryMethod || order.deliveryMethod === "courier") return

  const settings = await getDeliverySettings()

  const req: CreateShipmentRequest = {
    orderId: order.id,
    carrier: order.deliveryMethod as "cdek" | "pochta",
    tariffCode: order.tariffCode || 136,
    deliveryType: (order.deliveryType as "door" | "pvz") || "pvz",
    pickupPointCode: order.pickupPointCode || undefined,
    senderCityCode: settings.sender_city_code,
    recipientCityCode: order.destinationCityCode || undefined,
    recipientPostalCode: undefined,
    recipientName: order.customerName,
    recipientPhone: order.customerPhone,
    recipientAddress: order.deliveryAddress || undefined,
    items: order.items.map((item) => ({
      name: item.name,
      weight: parseInt(settings.default_weight_grams) || 300,
      price: item.price,
      quantity: item.quantity,
    })),
    weight: order.packageWeight || parseInt(settings.default_weight_grams) || 300,
    length: parseInt(settings.default_length_cm) || 20,
    width: parseInt(settings.default_width_cm) || 15,
    height: parseInt(settings.default_height_cm) || 10,
  }

  let result

  if (order.deliveryMethod === "cdek") {
    if (!settings.cdek_client_id || !settings.cdek_client_secret) {
      throw new Error("CDEK credentials not configured")
    }
    let tariffs: number[] = [136, 137]
    try { tariffs = JSON.parse(settings.cdek_tariffs) } catch { /* defaults */ }

    const provider = createCdekProvider({
      clientId: settings.cdek_client_id,
      clientSecret: settings.cdek_client_secret,
      testMode: settings.cdek_test_mode === "true",
      tariffs,
      senderCityCode: settings.sender_city_code,
    })
    result = await provider.createShipment(req)
  } else if (order.deliveryMethod === "pochta") {
    const provider = createPochtaProvider({
      accessToken: settings.pochta_access_token || undefined,
      userAuth: settings.pochta_user_auth || undefined,
      objectType: parseInt(settings.pochta_object_type) || 47030,
      senderPostalCode: settings.sender_postal_code,
    })
    result = await provider.createShipment(req)
  } else {
    return
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      carrierOrderId: result.carrierOrderId,
      carrierOrderNum: result.carrierOrderNum,
      trackingNumber: result.trackingNumber,
    },
  })
}

export async function refreshTrackingForOrder(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order?.carrierOrderId || !order.deliveryMethod) return null

  const settings = await getDeliverySettings()

  if (order.deliveryMethod === "cdek") {
    let tariffs: number[] = [136, 137]
    try { tariffs = JSON.parse(settings.cdek_tariffs) } catch { /* defaults */ }

    const provider = createCdekProvider({
      clientId: settings.cdek_client_id,
      clientSecret: settings.cdek_client_secret,
      testMode: settings.cdek_test_mode === "true",
      tariffs,
      senderCityCode: settings.sender_city_code,
    })

    const statuses = await provider.getTrackingStatus(order.carrierOrderId)
    if (statuses.length > 0) {
      const latest = statuses[0]
      await prisma.order.update({
        where: { id: orderId },
        data: { carrierStatus: latest.name },
      })
    }
    return statuses
  }

  return null
}
