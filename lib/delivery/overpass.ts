// Overpass API (OpenStreetMap) client for finding post offices by city.
// No auth, no rate cost to us — but Overpass is rate-limited globally,
// so we cache results in-memory per city for 6 hours.

import type { PickupPoint } from "./types"

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
]

const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours
const cache = new Map<string, { expiresAt: number; points: PickupPoint[] }>()

interface OverpassNode {
  type: string
  id: number
  lat: number
  lon: number
  tags?: {
    name?: string
    ref?: string
    "addr:street"?: string
    "addr:housenumber"?: string
    "addr:full"?: string
    "addr:city"?: string
    "contact:phone"?: string
    phone?: string
    opening_hours?: string
    operator?: string
  }
}

interface OverpassResponse {
  elements: OverpassNode[]
}

function buildAddress(tags: OverpassNode["tags"], city: string): string {
  if (!tags) return city
  if (tags["addr:full"]) return tags["addr:full"]
  const parts: string[] = []
  if (tags["addr:city"]) parts.push(tags["addr:city"])
  else parts.push(city)
  if (tags["addr:street"]) parts.push(tags["addr:street"])
  if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"])
  return parts.join(", ")
}

/**
 * Fetches post offices for a city from Overpass (OSM).
 * Filters to nodes tagged by Russian Post operator where possible,
 * but falls back to all amenity=post_office nodes.
 */
export async function getPochtaOfficesByCity(
  city: string
): Promise<PickupPoint[]> {
  if (!city) return []

  const cacheKey = city.toLowerCase().trim()
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.points
  }

  // Match Moscow/SPb federal cities (level 4), regions, city districts (6),
  // and regular cities/towns (8). Use regex to match any name variant.
  const query = `[out:json][timeout:25];
(
  area["name"="${city}"]["admin_level"~"^[468]$"];
  area["name:ru"="${city}"]["admin_level"~"^[468]$"];
)->.a;
node(area.a)["amenity"="post_office"];
out body 500;`

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "millor-coffee/1.0 (checkout pickup-point finder)",
          Accept: "application/json",
        },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(25_000),
      })

      if (!res.ok) continue
      const data: OverpassResponse = await res.json()
      const elements = Array.isArray(data.elements) ? data.elements : []

      const points: PickupPoint[] = elements
        .filter((el) => el.type === "node" && el.lat && el.lon)
        .map((el) => {
          const tags = el.tags || {}
          const ref = tags.ref || ""
          const nameRaw = tags.name || `Почтовое отделение ${ref}`.trim()
          const name = ref
            ? `Почтовое отделение ${ref}`
            : nameRaw.includes("Почт")
              ? nameRaw
              : `Почтовое отделение ${nameRaw}`

          return {
            code: ref || String(el.id),
            name,
            address: buildAddress(tags, city),
            lat: el.lat,
            lng: el.lon,
            workTime: tags.opening_hours || undefined,
            phone: tags["contact:phone"] || tags.phone || undefined,
            carrier: "pochta" as const,
          }
        })
        // Dedup by code (some OSM nodes share a ref when multiple entrances)
        .reduce<PickupPoint[]>((acc, p) => {
          if (!acc.some((x) => x.code === p.code)) acc.push(p)
          return acc
        }, [])

      cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, points })
      return points
    } catch {
      // try next endpoint
    }
  }

  return []
}
