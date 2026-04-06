import type { DeliveryRate, DeliveryRateRequest } from "./types"
import { getDeliverySettings, getMarkupRules, getDefaultSenderLocation } from "@/lib/dal/delivery-settings"
import { createCdekProvider } from "./cdek"
import { createPochtaProvider } from "./pochta"
import { createCourierProvider } from "./courier"
import type { DeliveryMarkupRule } from "@prisma/client"

function applyMarkups(
  rates: DeliveryRate[],
  rules: DeliveryMarkupRule[],
  cartTotal: number,
  weight: number
): DeliveryRate[] {
  return rates.map((rate) => {
    let price = rate.price

    for (const rule of rules) {
      // Filter by carrier
      if (rule.carrier !== "all" && rule.carrier !== rate.carrier) continue
      // Filter by weight
      if (rule.minWeight && weight < rule.minWeight) continue
      if (rule.maxWeight && weight > rule.maxWeight) continue
      // Filter by cart total
      if (rule.minPrice && cartTotal < rule.minPrice) continue

      if (rule.type === "percent") {
        price = Math.ceil(price * (1 + rule.value / 100))
      } else if (rule.type === "fixed") {
        price = price + rule.value
      } else if (rule.type === "replace") {
        price = rule.value
      }
    }

    return { ...rate, priceWithMarkup: price }
  })
}

export async function calculateDeliveryRates(params: {
  toCityCode?: string
  toPostalCode?: string
  toCity?: string
  toRegion?: string
  cartWeight?: number
  cartTotal?: number
}): Promise<DeliveryRate[]> {
  const settings = await getDeliverySettings()
  const rules = await getMarkupRules()
  const sender = getDefaultSenderLocation(settings)

  const weight = params.cartWeight || parseInt(settings.default_weight_grams) || 300
  const cartTotal = params.cartTotal || 0

  const req: DeliveryRateRequest = {
    fromCityCode: sender.cityCode,
    fromPostalCode: sender.postalCode,
    toCityCode: params.toCityCode,
    toPostalCode: params.toPostalCode,
    toCity: params.toCity,
    toRegion: params.toRegion,
    weight,
    length: parseInt(settings.default_length_cm) || 20,
    width: parseInt(settings.default_width_cm) || 15,
    height: parseInt(settings.default_height_cm) || 10,
    cartTotal,
  }

  const providers = []

  // CDEK
  if (settings.cdek_enabled === "true" && settings.cdek_client_id && settings.cdek_client_secret) {
    let tariffs: number[] = [136, 137]
    try {
      tariffs = JSON.parse(settings.cdek_tariffs)
    } catch { /* use defaults */ }

    providers.push(
      createCdekProvider({
        clientId: settings.cdek_client_id,
        clientSecret: settings.cdek_client_secret,
        testMode: settings.cdek_test_mode === "true",
        tariffs,
        senderCityCode: sender.cityCode,
      }).calculateRates(req)
    )
  }

  // Pochta RF
  if (settings.pochta_enabled === "true" && params.toPostalCode) {
    providers.push(
      createPochtaProvider({
        accessToken: settings.pochta_access_token || undefined,
        userAuth: settings.pochta_user_auth || undefined,
        objectType: parseInt(settings.pochta_object_type) || 47030,
        senderPostalCode: sender.postalCode,
      }).calculateRates(req)
    )
  }

  // Local courier
  if (settings.courier_enabled === "true") {
    providers.push(
      createCourierProvider({
        price: parseInt(settings.courier_price) || 500,
        regionPrice: parseInt(settings.courier_region_price) || 700,
        city: settings.courier_city || "Калининград",
        freeThreshold: parseInt(settings.courier_free_threshold) || parseInt(settings.free_delivery_threshold) || 3000,
      }).calculateRates(req)
    )
  }

  const results = await Promise.allSettled(providers)
  const allRates: DeliveryRate[] = []

  for (const result of results) {
    if (result.status === "fulfilled") {
      allRates.push(...result.value)
    }
  }

  // Apply free delivery threshold from global settings
  const freeThreshold = parseInt(settings.free_delivery_threshold) || 0

  const withMarkups = applyMarkups(allRates, rules, cartTotal, weight)

  // Apply free delivery threshold
  const final = withMarkups.map((rate) => {
    if (freeThreshold > 0 && cartTotal >= freeThreshold && rate.carrier !== "courier") {
      return { ...rate, priceWithMarkup: 0 }
    }
    return rate
  })

  // Sort by price
  return final.sort((a, b) => a.priceWithMarkup - b.priceWithMarkup)
}

// Re-export providers for shipment creation
export { createCdekProvider } from "./cdek"
export { createPochtaProvider } from "./pochta"
export { createCourierProvider } from "./courier"
