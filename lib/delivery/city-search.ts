import type { CitySearchResult } from "./types"
import { getDeliverySettings } from "@/lib/dal/delivery-settings"

export async function searchCities(query: string): Promise<CitySearchResult[]> {
  if (!query || query.length < 2) return []

  const settings = await getDeliverySettings()
  const clientId = settings.cdek_client_id
  const clientSecret = settings.cdek_client_secret
  const testMode = settings.cdek_test_mode === "true"

  if (!clientId || !clientSecret) return []

  const apiUrl = testMode ? "https://api.edu.cdek.ru" : "https://api.cdek.ru"

  // Get token
  const tokenRes = await fetch(`${apiUrl}/v2/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  })

  if (!tokenRes.ok) return []
  const tokenData = await tokenRes.json()

  // Search cities
  const params = new URLSearchParams({
    country_codes: "RU",
    city: query,
    size: "20",
  })

  const res = await fetch(`${apiUrl}/v2/location/cities?${params}`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })

  if (!res.ok) return []

  const cities = await res.json()
  if (!Array.isArray(cities)) return []

  return cities.map(
    (c: { code: number; city: string; region: string; postal_codes?: string[] }) => ({
      code: c.code.toString(),
      city: c.city,
      region: c.region,
      postalCodes: c.postal_codes || [],
    })
  )
}
