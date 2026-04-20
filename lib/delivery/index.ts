import type { DeliveryRate, DeliveryRateRequest } from "./types"
import { getDeliverySettings, getMarkupRules, getDefaultSenderLocation, getDeliveryRules } from "@/lib/dal/delivery-settings"
import { createCdekProvider } from "./cdek"
import { createPochtaProvider } from "./pochta"
import { createCourierProvider } from "./courier"
import type { DeliveryMarkupRule, DeliveryRule } from "@prisma/client"

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

function applyDeliveryRules(
  rates: DeliveryRate[],
  rules: DeliveryRule[],
  cartTotal: number,
  city?: string
): DeliveryRate[] {
  // First pass: check "disable" rules — remove matching rates entirely
  const disableRules = rules.filter((r) => r.action === "disable")
  let filtered = rates.filter((rate) => {
    for (const rule of disableRules) {
      if (matchesRule(rule, rate, cartTotal, city)) return false
    }
    return true
  })

  // Second pass: apply "free" and "discount" rules
  const priceRules = rules.filter((r) => r.action === "free" || r.action === "discount")
  filtered = filtered.map((rate) => {
    let price = rate.priceWithMarkup

    for (const rule of priceRules) {
      if (!matchesRule(rule, rate, cartTotal, city)) continue

      // Check maxDeliveryPrice against the ORIGINAL calculated price (before rule adjustments)
      if (rule.maxDeliveryPrice !== null && rate.priceWithMarkup >= rule.maxDeliveryPrice) continue

      if (rule.action === "free") {
        price = 0
        break // Free trumps everything
      } else if (rule.action === "discount" && rule.discountAmount) {
        price = Math.max(0, price - rule.discountAmount)
      }
    }

    return { ...rate, priceWithMarkup: price }
  })

  return filtered
}

function matchesRule(
  rule: DeliveryRule,
  rate: DeliveryRate,
  cartTotal: number,
  city?: string
): boolean {
  // Carrier match
  if (rule.carrier !== "all" && rule.carrier !== rate.carrier) return false
  // Delivery type match
  if (rule.deliveryType && rule.deliveryType !== rate.deliveryType) return false
  // Min cart total
  if (rule.minCartTotal !== null && cartTotal < rule.minCartTotal) return false
  // City match (case-insensitive)
  if (rule.city && city && rule.city.toLowerCase() !== city.toLowerCase()) return false
  if (rule.city && !city) return false

  return true
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
  const markupRules = await getMarkupRules()
  const deliveryRules = await getDeliveryRules()
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

  // Pochta RF — works with postal code or city name (provider looks up postal code)
  if (settings.pochta_enabled === "true" && (params.toPostalCode || params.toCity)) {
    providers.push(
      createPochtaProvider({
        accessToken: settings.pochta_access_token || undefined,
        userAuth: settings.pochta_user_auth || undefined,
        objectType: parseInt(settings.pochta_object_type) || 47030,
        senderPostalCode: sender.postalCode,
        dadataApiKey: settings.dadata_api_key || undefined,
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

  const withMarkups = applyMarkups(allRates, markupRules, cartTotal, weight)

  // Apply conditional delivery rules (free delivery, discounts, disabling)
  const withRules = applyDeliveryRules(withMarkups, deliveryRules, cartTotal, params.toCity)

  // Sort by price
  return withRules.sort((a, b) => a.priceWithMarkup - b.priceWithMarkup)
}

// Re-export providers for shipment creation
export { createCdekProvider } from "./cdek"
export { createPochtaProvider } from "./pochta"
export { createCourierProvider } from "./courier"
