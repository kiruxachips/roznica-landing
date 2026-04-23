import { NextRequest, NextResponse } from "next/server"
import { getDeliverySettings } from "@/lib/dal/delivery-settings"
import { suggestAddress } from "@/lib/delivery/dadata"
import { withRateLimit, DELIVERY_RATE_LIMIT } from "@/lib/api-helpers"

interface SuggestionDTO {
  value: string
  postalCode: string
  lat?: number | null
  lng?: number | null
}

export const GET = withRateLimit(async (request: NextRequest) => {
  const q = request.nextUrl.searchParams.get("q")?.trim()
  const city = request.nextUrl.searchParams.get("city")?.trim()

  if (!q || q.length < 2 || !city) {
    return NextResponse.json([])
  }

  const settings = await getDeliverySettings()

  // Primary: DaData (gold-standard for Russian addresses, structured response).
  if (settings.dadata_api_key) {
    const suggestions = await suggestAddress(settings.dadata_api_key, q, {
      city,
      count: 7,
    })

    if (suggestions.length > 0) {
      const mapped: SuggestionDTO[] = suggestions.map((s) => ({
        value: s.value,
        postalCode: s.postalCode,
        lat: s.geoLat,
        lng: s.geoLon,
      }))
      return NextResponse.json(mapped)
    }
    // Fall through to Yandex if DaData returned nothing
  }

  // Fallback: Yandex Geocoder
  if (settings.yandex_maps_api_key) {
    try {
      const params = new URLSearchParams({
        apikey: settings.yandex_maps_api_key,
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

      const cityLower = city.toLowerCase()
      const suggestions: SuggestionDTO[] = members
        .map((m: Record<string, unknown>) => {
          const obj = (m.GeoObject as Record<string, unknown>) || {}
          const metaProps = obj.metaDataProperty as
            | Record<string, unknown>
            | undefined
          const meta = metaProps?.GeocoderMetaData as
            | Record<string, unknown>
            | undefined
          const address = meta?.Address as Record<string, unknown> | undefined
          const formatted = (address?.formatted as string) || (obj.name as string) || ""
          const postalCode = (address?.postal_code as string) || ""
          const point = (obj.Point as { pos?: string } | undefined)?.pos
          const [lng, lat] = (point || "").split(" ").map(parseFloat)

          if (!formatted.toLowerCase().includes(cityLower)) return null
          return {
            value: formatted,
            postalCode,
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null,
          }
        })
        .filter(Boolean)

      return NextResponse.json(suggestions)
    } catch {
      return NextResponse.json([])
    }
  }

  return NextResponse.json([])
}, { ...DELIVERY_RATE_LIMIT, tag: "delivery-address-suggest" })
