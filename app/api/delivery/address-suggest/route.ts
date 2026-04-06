import { NextRequest, NextResponse } from "next/server"
import { getDeliverySettings } from "@/lib/dal/delivery-settings"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim()
  const city = request.nextUrl.searchParams.get("city")?.trim()

  if (!q || q.length < 3 || !city) {
    return NextResponse.json([])
  }

  try {
    const settings = await getDeliverySettings()
    const apiKey = settings.yandex_maps_api_key

    if (!apiKey) return NextResponse.json([])

    // Yandex Geocoder with city bias
    const params = new URLSearchParams({
      apikey: apiKey,
      geocode: `${city}, ${q}`,
      format: "json",
      results: "5",
      lang: "ru_RU",
    })

    const res = await fetch(`https://geocode-maps.yandex.ru/1.x/?${params}`, {
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return NextResponse.json([])

    const data = await res.json()
    const members = data?.response?.GeoObjectCollection?.featureMember || []

    const suggestions = members
      .map((m: any) => {
        const obj = m.GeoObject
        const address = obj?.metaDataProperty?.GeocoderMetaData?.Address
        const formatted = address?.formatted || obj?.name || ""
        const postalCode = address?.postal_code || ""

        // Only show results that contain the city name
        if (!formatted.toLowerCase().includes(city.toLowerCase())) return null

        return {
          value: formatted,
          postalCode,
        }
      })
      .filter(Boolean)

    return NextResponse.json(suggestions)
  } catch {
    return NextResponse.json([])
  }
}
