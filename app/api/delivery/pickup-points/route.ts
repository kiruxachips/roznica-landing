import { NextRequest, NextResponse } from "next/server"
import { getDeliverySettings } from "@/lib/dal/delivery-settings"
import { createCdekProvider } from "@/lib/delivery/cdek"

export async function GET(request: NextRequest) {
  const cityCode = request.nextUrl.searchParams.get("city_code")
  const carrier = request.nextUrl.searchParams.get("carrier") || "cdek"

  if (!cityCode) {
    return NextResponse.json([])
  }

  try {
    const settings = await getDeliverySettings()

    if (carrier === "cdek" && settings.cdek_enabled === "true") {
      let tariffs: number[] = [136, 137]
      try { tariffs = JSON.parse(settings.cdek_tariffs) } catch { /* defaults */ }

      const provider = createCdekProvider({
        clientId: settings.cdek_client_id,
        clientSecret: settings.cdek_client_secret,
        testMode: settings.cdek_test_mode === "true",
        tariffs,
        senderCityCode: settings.sender_city_code,
      })

      const points = await provider.getPickupPoints(cityCode)
      return NextResponse.json(points)
    }

    return NextResponse.json([])
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
