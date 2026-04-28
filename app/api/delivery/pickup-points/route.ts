import { NextRequest, NextResponse } from "next/server"
import { getDeliverySettings, getDefaultSenderLocation } from "@/lib/dal/delivery-settings"
import { createCdekProvider } from "@/lib/delivery/cdek"
import { createPochtaProvider } from "@/lib/delivery/pochta"
import { withRateLimit, DELIVERY_RATE_LIMIT } from "@/lib/api-helpers"

export const GET = withRateLimit(async (request: NextRequest) => {
  const cityCode = request.nextUrl.searchParams.get("city_code")
  const carrier = request.nextUrl.searchParams.get("carrier") || "cdek"
  const city = request.nextUrl.searchParams.get("city") || ""
  const region = request.nextUrl.searchParams.get("region") || ""
  const postalCode = request.nextUrl.searchParams.get("postal_code") || ""

  if (!cityCode && !city) {
    return NextResponse.json([])
  }

  try {
    const settings = await getDeliverySettings()
    const sender = getDefaultSenderLocation(settings)

    if (carrier === "cdek" && settings.cdek_enabled === "true") {
      let tariffs: number[] = [231, 232, 138, 139]
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

      const points = await provider.getPickupPoints(cityCode || "")
      return NextResponse.json(points, {
        headers: { "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=3600" },
      })
    }

    if (carrier === "pochta" && settings.pochta_enabled === "true" && city.trim()) {
      const provider = createPochtaProvider({
        accessToken: settings.pochta_access_token || undefined,
        userAuth: settings.pochta_user_auth || undefined,
        objectType: parseInt(settings.pochta_object_type) || 47030,
        senderPostalCode: sender.postalCode,
        dadataApiKey: settings.dadata_api_key || undefined,
      })

      // Передаём region + postalCode для disambiguation городов-тёзок
      // (Гурьевск Калининградский vs Кемеровский и т.п.). Без этого
      // Overpass возвращает OSM-узлы из всех одноимённых городов.
      const points = await provider.getPickupPoints(city, {
        region: region || undefined,
        postalCode: postalCode || undefined,
      })
      return NextResponse.json(points, {
        headers: { "Cache-Control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=3600" },
      })
    }

    return NextResponse.json([])
  } catch (error) {
    console.error("[pickup-points] Error fetching pickup points:", error)
    return NextResponse.json([], { status: 500 })
  }
}, { ...DELIVERY_RATE_LIMIT, tag: "delivery-pickup-points" })
