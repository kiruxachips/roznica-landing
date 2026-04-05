import type { CitySearchResult } from "./types"
import { cdekFetch, getApiUrl } from "./cdek"
import { getDeliverySettings } from "@/lib/dal/delivery-settings"

export async function searchCities(query: string): Promise<CitySearchResult[]> {
  if (!query || query.length < 2) return []

  const settings = await getDeliverySettings()
  const clientId = settings.cdek_client_id
  const clientSecret = settings.cdek_client_secret
  const testMode = settings.cdek_test_mode === "true"

  if (!clientId || !clientSecret) return []

  const params = new URLSearchParams({
    country_codes: "RU",
    city: query,
    size: "20",
  })

  try {
    const cities = await cdekFetch(`/v2/location/cities?${params}`, {
      clientId,
      clientSecret,
      testMode,
    })

    if (!Array.isArray(cities)) return []

    return cities.map(
      (c: { code: number; city: string; region: string; postal_codes?: string[] }) => ({
        code: c.code.toString(),
        city: c.city,
        region: c.region,
        postalCodes: c.postal_codes || [],
      })
    )
  } catch (e) {
    console.error("CDEK city search failed:", e)
    return []
  }
}
