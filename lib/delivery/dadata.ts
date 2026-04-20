// DaData address suggestions API wrapper.
// Free tier: 10 000 suggestions/day. Standard for Russian addresses.
// Docs: https://dadata.ru/api/suggest/address/

import { fetchWithTimeout } from "./utils"

const DADATA_SUGGEST_URL =
  "https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address"
const DADATA_GEOLOCATE_URL =
  "https://suggestions.dadata.ru/suggestions/api/4_1/rs/geolocate/address"

export interface DadataAddressSuggestion {
  value: string
  unrestrictedValue: string
  postalCode: string
  city: string
  street: string
  house: string
  flat: string
  geoLat: number | null
  geoLon: number | null
  fiasLevel: string
}

interface DadataApiResponse {
  suggestions?: Array<{
    value: string
    unrestricted_value: string
    data: {
      postal_code?: string
      city?: string
      city_with_type?: string
      settlement_with_type?: string
      street?: string
      street_with_type?: string
      house?: string
      flat?: string
      geo_lat?: string | null
      geo_lon?: string | null
      fias_level?: string
    }
  }>
}

function mapSuggestion(
  s: NonNullable<DadataApiResponse["suggestions"]>[number]
): DadataAddressSuggestion {
  return {
    value: s.value,
    unrestrictedValue: s.unrestricted_value,
    postalCode: s.data.postal_code || "",
    city: s.data.city_with_type || s.data.settlement_with_type || s.data.city || "",
    street: s.data.street_with_type || s.data.street || "",
    house: s.data.house || "",
    flat: s.data.flat || "",
    geoLat: s.data.geo_lat ? parseFloat(s.data.geo_lat) : null,
    geoLon: s.data.geo_lon ? parseFloat(s.data.geo_lon) : null,
    fiasLevel: s.data.fias_level || "",
  }
}

export async function suggestAddress(
  apiKey: string,
  query: string,
  options: {
    city?: string
    count?: number
  } = {}
): Promise<DadataAddressSuggestion[]> {
  if (!apiKey || !query || query.length < 2) return []

  const body: Record<string, unknown> = {
    query,
    count: options.count || 7,
  }

  // Restrict to city. DaData "locations" accepts arrays with various filters.
  if (options.city) {
    body.locations = [{ city: options.city }, { settlement: options.city }]
    body.restrict_value = true
  }

  try {
    const res = await fetchWithTimeout(
      DADATA_SUGGEST_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      5000
    )

    if (!res.ok) return []

    const data: DadataApiResponse = await res.json()
    return (data.suggestions || []).map(mapSuggestion)
  } catch {
    return []
  }
}

/** Geolocate by lat/lng — find nearest address */
export async function geolocateAddress(
  apiKey: string,
  lat: number,
  lng: number,
  radiusMeters = 100
): Promise<DadataAddressSuggestion | null> {
  if (!apiKey) return null

  try {
    const res = await fetchWithTimeout(
      DADATA_GEOLOCATE_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Token ${apiKey}`,
        },
        body: JSON.stringify({
          lat,
          lon: lng,
          radius_meters: radiusMeters,
          count: 1,
        }),
      },
      5000
    )

    if (!res.ok) return null
    const data: DadataApiResponse = await res.json()
    const first = data.suggestions?.[0]
    return first ? mapSuggestion(first) : null
  } catch {
    return null
  }
}

/** Look up postal code for a city (used by Pochta provider). */
export async function getPostalCodeForCity(
  apiKey: string,
  city: string,
  region?: string
): Promise<string> {
  // Include region in query so DaData disambiguates cities with the same name
  // and returns a street-level result with a real postal code.
  const query = region ? `${city}, ${region}` : city
  const suggestions = await suggestAddress(apiKey, query, { count: 5 })
  const withCode = suggestions.find((s) => s.postalCode)
  return withCode?.postalCode || ""
}
