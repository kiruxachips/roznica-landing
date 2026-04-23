import { NextRequest, NextResponse } from "next/server"
import { calculateDeliveryRates } from "@/lib/delivery"
import type { ItemToPack } from "@/lib/delivery/packaging"
import { withRateLimit, DELIVERY_RATE_LIMIT } from "@/lib/api-helpers"

function sanitizeItems(input: unknown): ItemToPack[] {
  if (!Array.isArray(input)) return []
  const out: ItemToPack[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue
    const r = raw as Record<string, unknown>
    const weightGrams = typeof r.weightGrams === "number" ? r.weightGrams : Number(r.weightGrams)
    const quantity = typeof r.quantity === "number" ? r.quantity : Number(r.quantity)
    if (Number.isFinite(weightGrams) && weightGrams > 0 && Number.isFinite(quantity) && quantity > 0) {
      out.push({ weightGrams: Math.round(weightGrams), quantity: Math.round(quantity) })
    }
  }
  return out
}

// Обёрнут в rate-limit: endpoint публичный и дергает внешний СДЭК / Почта API.
// Без throttling burst-запросами можно исчерпать квоту у провайдеров.
export const POST = withRateLimit(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { cityCode, postalCode, city, region, items, cartTotal } = body

    const rates = await calculateDeliveryRates({
      toCityCode: cityCode,
      toPostalCode: postalCode,
      toCity: city,
      toRegion: region,
      items: sanitizeItems(items),
      cartTotal,
    })

    return NextResponse.json(rates)
  } catch {
    return NextResponse.json({ error: "Failed to calculate rates" }, { status: 500 })
  }
}, { ...DELIVERY_RATE_LIMIT, tag: "delivery-rates" })
