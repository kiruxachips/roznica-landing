import { prisma } from "@/lib/prisma"
import {
  getDeliverySettings,
  getDefaultSenderLocation,
  parseSenderLocations,
  type SenderLocation,
} from "@/lib/dal/delivery-settings"
import { createCdekProvider } from "./cdek"
import { createPochtaProvider } from "./pochta"
import { planPackages, parseBoxPresets, type ItemToPack, type Package } from "./packaging"
import type { CreateShipmentRequest } from "./types"

function parseWeightGrams(str: string): number {
  const lower = str.toLowerCase().trim()
  const match = lower.match(/^([\d.,]+)\s*(кг|г|kg|g)?$/)
  if (!match) return 0
  const num = parseFloat(match[1].replace(",", "."))
  if (isNaN(num)) return 0
  const unit = match[2] || "г"
  return unit === "кг" || unit === "kg" ? Math.round(num * 1000) : Math.round(num)
}

function isValidPackage(p: unknown): p is Package {
  if (!p || typeof p !== "object") return false
  const o = p as Record<string, unknown>
  return (
    typeof o.length === "number" && o.length > 0 &&
    typeof o.width === "number" && o.width > 0 &&
    typeof o.height === "number" && o.height > 0 &&
    typeof o.weight === "number" && o.weight > 0 &&
    typeof o.presetCode === "string"
  )
}

function parsePackagePlan(raw: unknown): Package[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const valid = raw.filter(isValidPackage)
  return valid.length > 0 ? valid : null
}

export async function createShipmentForOrder(
  orderId: string,
  senderLocationIndex?: number
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  })

  if (!order) throw new Error("Order not found")
  if (order.carrierOrderId) return // Already created
  if (!order.deliveryMethod || order.deliveryMethod === "courier") return

  // Validate pvz orders have pickup point code
  if (order.deliveryType === "pvz" && !order.pickupPointCode) {
    const label = order.deliveryMethod === "pochta" ? "код почтового отделения" : "код пункта выдачи"
    throw new Error(`Не указан ${label} для заказа ПВЗ`)
  }
  // Validate door orders have address
  if (order.deliveryType === "door" && !order.deliveryAddress) {
    throw new Error("Не указан адрес доставки")
  }

  const settings = await getDeliverySettings()

  // Pick sender location: explicit index or default
  let sender: SenderLocation
  if (senderLocationIndex !== undefined) {
    const locations = parseSenderLocations(settings.sender_locations || "[]")
    sender = locations[senderLocationIndex] || getDefaultSenderLocation(settings)
  } else {
    sender = getDefaultSenderLocation(settings)
  }

  // Берём сохранённый план упаковки, иначе пересчитываем из позиций заказа.
  const storedPlan = parsePackagePlan(order.packagePlan as unknown)
  let packages: Package[]
  if (storedPlan && storedPlan.length > 0) {
    packages = storedPlan
  } else {
    const presets = parseBoxPresets(settings.box_presets)
    const items: ItemToPack[] = order.items.map((item) => ({
      weightGrams:
        parseWeightGrams(item.weight) || parseInt(settings.default_weight_grams) || 300,
      quantity: item.quantity,
    }))
    packages = planPackages(items, presets)
  }

  const req: CreateShipmentRequest = {
    orderId: order.id,
    carrier: order.deliveryMethod as "cdek" | "pochta",
    tariffCode: order.tariffCode || 136,
    deliveryType: (order.deliveryType as "door" | "pvz") || "pvz",
    pickupPointCode: order.pickupPointCode || undefined,
    senderCityCode: sender.cityCode,
    senderPostalCode: sender.postalCode,
    recipientCityCode: order.destinationCityCode || undefined,
    recipientPostalCode: order.postalCode || undefined,
    recipientName: order.customerName,
    recipientPhone: order.customerPhone,
    recipientAddress: order.deliveryAddress || undefined,
    items: order.items.map((item) => ({
      name: item.name,
      weight:
        parseWeightGrams(item.weight) || parseInt(settings.default_weight_grams) || 300,
      price: item.price,
      quantity: item.quantity,
    })),
    packages,
  }

  let result

  if (order.deliveryMethod === "cdek") {
    if (!settings.cdek_client_id || !settings.cdek_client_secret) {
      throw new Error("CDEK credentials not configured")
    }
    let tariffs: number[] = [233, 234, 136, 137]
    try {
      const parsed = JSON.parse(settings.cdek_tariffs)
      if (Array.isArray(parsed) && parsed.length > 0) tariffs = parsed
    } catch { /* defaults */ }

    const provider = createCdekProvider({
      clientId: settings.cdek_client_id,
      clientSecret: settings.cdek_client_secret,
      testMode: settings.cdek_test_mode === "true",
      tariffs,
      senderCityCode: sender.cityCode,
    })
    result = await provider.createShipment(req)
  } else if (order.deliveryMethod === "pochta") {
    const provider = createPochtaProvider({
      accessToken: settings.pochta_access_token || undefined,
      userAuth: settings.pochta_user_auth || undefined,
      objectType: parseInt(settings.pochta_object_type) || 47030,
      senderPostalCode: sender.postalCode,
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
    const sender = getDefaultSenderLocation(settings)
    let tariffs: number[] = [233, 234, 136, 137]
    try {
      const parsed = JSON.parse(settings.cdek_tariffs)
      if (Array.isArray(parsed) && parsed.length > 0) tariffs = parsed
    } catch { /* defaults */ }

    const provider = createCdekProvider({
      clientId: settings.cdek_client_id,
      clientSecret: settings.cdek_client_secret,
      testMode: settings.cdek_test_mode === "true",
      tariffs,
      senderCityCode: sender.cityCode,
    })

    // Для CDEK сохранён UUID заказа (один). Мульти-коробки внутри одного заказа —
    // CDEK возвращает агрегированные статусы.
    const firstId = order.carrierOrderId.split(",")[0].trim()
    const statuses = await provider.getTrackingStatus(firstId)
    if (statuses.length > 0) {
      const latest = statuses[0]
      await prisma.order.update({
        where: { id: orderId },
        data: { carrierStatus: latest.name },
      })
    }
    return statuses
  }

  if (order.deliveryMethod === "pochta") {
    if (!order.trackingNumber) return null

    const provider = createPochtaProvider({
      accessToken: settings.pochta_access_token || undefined,
      userAuth: settings.pochta_user_auth || undefined,
      trackingLogin: settings.pochta_tracking_login || undefined,
      trackingPassword: settings.pochta_tracking_password || undefined,
      objectType: parseInt(settings.pochta_object_type) || 47030,
      senderPostalCode: getDefaultSenderLocation(settings).postalCode,
    })

    const statuses = await provider.getTrackingStatus(order.trackingNumber)
    if (statuses.length > 0) {
      const latest = statuses[0]
      const updateData: { carrierStatus: string; status?: string } = {
        carrierStatus: latest.name,
      }

      // Map Pochta operation types to order status
      const operTypeId = parseInt(latest.code.split(".")[0])
      if (operTypeId === 2 && order.status !== "delivered") {
        updateData.status = "delivered"
      } else if (operTypeId === 1 && ["paid", "confirmed"].includes(order.status)) {
        updateData.status = "shipped"
      }

      await prisma.order.update({
        where: { id: orderId },
        data: updateData,
      })
    }
    return statuses
  }

  return null
}
