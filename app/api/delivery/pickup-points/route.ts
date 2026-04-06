import { NextRequest, NextResponse } from "next/server"
import { getDeliverySettings, getDefaultSenderLocation } from "@/lib/dal/delivery-settings"
import { createCdekProvider } from "@/lib/delivery/cdek"
import { createPochtaProvider } from "@/lib/delivery/pochta"

export async function GET(request: NextRequest) {
  const cityCode = request.nextUrl.searchParams.get("city_code")
  const carrier = request.nextUrl.searchParams.get("carrier") || "cdek"
  const city = request.nextUrl.searchParams.get("city") || ""

  if (!cityCode && !city) {
    return NextResponse.json([])
  }

  try {
    const settings = await getDeliverySettings()
    const sender = getDefaultSenderLocation(settings)

    if (carrier === "cdek" && settings.cdek_enabled === "true") {
      let tariffs: number[] = [136, 137]
      try { tariffs = JSON.parse(settings.cdek_tariffs) } catch { /* defaults */ }

      const provider = createCdekProvider({
        clientId: settings.cdek_client_id,
        clientSecret: settings.cdek_client_secret,
        testMode: settings.cdek_test_mode === "true",
        tariffs,
        senderCityCode: sender.cityCode,
      })

      const points = await provider.getPickupPoints(cityCode || "")
      return NextResponse.json(points)
    }

    if (carrier === "pochta" && settings.pochta_enabled === "true" && city) {
      const provider = createPochtaProvider({
        accessToken: settings.pochta_access_token || undefined,
        userAuth: settings.pochta_user_auth || undefined,
        objectType: parseInt(settings.pochta_object_type) || 47030,
        senderPostalCode: sender.postalCode,
      })

      const points = await provider.getPickupPoints(city)
      return NextResponse.json(points)
    }

    return NextResponse.json([])
  } catch (error) {
    console.error("[pickup-points] Error fetching pickup points:", error)
    return NextResponse.json([], { status: 500 })
  }
}
