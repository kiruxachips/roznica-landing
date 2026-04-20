// Pickup-point resolver for Russian Post offices.
//
// Strategy: Overpass/OSM gives us comprehensive lat/lng coverage but OSM nodes
// rarely have full street addresses. The public Pochta API (no auth) returns
// proper "address-source" strings but has incomplete coordinate data.
// We run both in parallel and merge by postal code so every point gets both
// a real address and accurate coordinates.

import type { PickupPoint } from "./types"

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
]
const POCHTA_BY_ADDRESS = "https://api.pochta.ru/postoffice/1.0/by-address"

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
  }
}

interface PochtaOffice {
  "postal-code"?: string | number
  postalCode?: string | number
  "address-source"?: string
  addressSource?: string
  address?: string
  latitude?: string | number
  longitude?: string | number
  "work-time"?: string
  workTime?: string
  "phone-list"?: string[]
  phoneList?: string[]
}

function buildOsmAddress(tags: OverpassNode["tags"], city: string): string {
  if (!tags) return ""
  if (tags["addr:full"]) return tags["addr:full"]
  const parts: string[] = []
  if (tags["addr:city"]) parts.push(tags["addr:city"])
  if (tags["addr:street"]) parts.push(tags["addr:street"])
  if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"])
  if (parts.length === 0) return ""
  // If only city was added, treat it as no real address
  if (parts.length === 1 && parts[0] === city) return ""
  return parts.join(", ")
}

async function fetchOverpassPoints(city: string): Promise<OverpassNode[]> {
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
      const data = await res.json()
      return Array.isArray(data.elements) ? data.elements : []
    } catch {
      // try next endpoint
    }
  }
  return []
}

async function fetchPochtaApiOffices(city: string): Promise<PochtaOffice[]> {
  try {
    const url = `${POCHTA_BY_ADDRESS}?${new URLSearchParams({ address: city })}`
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/**
 * Fetches Russian Post offices for a city.
 * Merges Overpass (lat/lng) with Pochta public API (addresses) by postal code.
 */
export async function getPochtaOfficesByCity(city: string): Promise<PickupPoint[]> {
  if (!city) return []

  const cacheKey = city.toLowerCase().trim()
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.points
  }

  const [osmNodes, pochtaOffices] = await Promise.all([
    fetchOverpassPoints(city),
    fetchPochtaApiOffices(city),
  ])

  // Build lookup maps from Pochta API data keyed by postal code
  const pochtaByCode = new Map<string, PochtaOffice>()
  for (const o of pochtaOffices) {
    const code = String(o["postal-code"] || o.postalCode || "").trim()
    if (code) pochtaByCode.set(code, o)
  }

  // Convert OSM nodes → PickupPoints, enriching address from Pochta API
  const seen = new Set<string>()
  const points: PickupPoint[] = []

  for (const el of osmNodes) {
    if (el.type !== "node" || !el.lat || !el.lon) continue

    const tags = el.tags || {}
    const ref = (tags.ref || "").trim()
    const pochtaData = ref ? pochtaByCode.get(ref) : undefined

    // Address: prefer Pochta API (always has real address), fall back to OSM tags
    const pochtaAddr = pochtaData
      ? (pochtaData["address-source"] || pochtaData.addressSource || "")
      : ""
    const osmAddr = buildOsmAddress(tags, city)
    const address = String(pochtaAddr || osmAddr || city)

    const nameRaw = (tags.name || "").trim()
    const name = ref
      ? `Почтовое отделение ${ref}`
      : nameRaw.includes("Почт")
        ? nameRaw
        : nameRaw
          ? `Почтовое отделение ${nameRaw}`
          : `Почтовое отделение`

    const code = ref || String(el.id)
    if (seen.has(code)) continue
    seen.add(code)

    points.push({
      code,
      name,
      address,
      lat: el.lat,
      lng: el.lon,
      workTime: tags.opening_hours || undefined,
      phone: tags["contact:phone"] || tags.phone || undefined,
      carrier: "pochta" as const,
    })
  }

  // Add Pochta API offices that have coordinates but aren't in OSM
  for (const o of pochtaOffices) {
    const lat = Number(o.latitude)
    const lng = Number(o.longitude)
    if (!lat || !lng) continue

    const code = String(o["postal-code"] || o.postalCode || "").trim()
    if (!code || seen.has(code)) continue
    seen.add(code)

    const address = String(o["address-source"] || o.addressSource || o.address || city)
    points.push({
      code,
      name: `Почтовое отделение ${code}`,
      address,
      lat,
      lng,
      workTime: o["work-time"] || o.workTime || undefined,
      phone: o["phone-list"]?.[0] || o.phoneList?.[0] || undefined,
      carrier: "pochta" as const,
    })
  }

  cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, points })
  return points
}
