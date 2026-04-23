// Pickup-point resolver for Russian Post offices.
//
// Strategy: Overpass/OSM gives us comprehensive lat/lng coverage for nodes
// tagged amenity=post_office. Public Pochta API (no auth) returns proper
// `address-source` strings + phone/work-time + postal-code but often without
// coordinates.  Мы делаем **оба запроса параллельно всегда** (раньше было
// «Overpass → если пусто, Pochta API»; это пропускало малые города где
// Overpass ничего не находит из-за нестандартной OSM-area).
//
// Merge keys:
//   - Если отделение есть и в OSM, и в Pochta API (по postal-code) — берём
//     координаты OSM, адрес/телефон/часы из Pochta API (обычно точнее).
//   - Если только в Pochta API — сохраняем с lat/lng 0,0 (frontend отфильтрует
//     из карты, но покажет в списке).
//   - Если только в OSM — используем как есть.
//
// Cache: успешный непустой результат — 6 часов; пустой/ошибка — 60 секунд
// (чтобы временный сбой Overpass не обескровил checkout на полдня).

import type { PickupPoint } from "./types"

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
]
const POCHTA_BY_ADDRESS = "https://api.pochta.ru/postoffice/1.0/by-address"

const CACHE_TTL_OK = 6 * 60 * 60 * 1000 // 6 часов — когда данные есть
const CACHE_TTL_EMPTY = 60 * 1000 // 1 минута — когда пусто (быстрый retry)
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
  // Расширенный запрос: ищем area по нескольким подходящим admin_level и
  // вариантам place-tag — для малых городов Подмосковья area может быть
  // оформлена как city/town/village/suburb, а не только admin_level 4/6/8.
  const escaped = city.replace(/"/g, '\\"')
  const query = `[out:json][timeout:25];
(
  area["name"="${escaped}"]["admin_level"~"^[468]$"];
  area["name:ru"="${escaped}"]["admin_level"~"^[468]$"];
  area["name"="${escaped}"]["place"~"city|town|village|suburb"];
  area["name:ru"="${escaped}"]["place"~"city|town|village|suburb"];
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
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) {
        console.warn(`[overpass] ${endpoint} returned ${res.status} for "${city}"`)
        continue
      }
      const data = await res.json()
      const elements = Array.isArray(data.elements) ? data.elements : []
      if (elements.length === 0) {
        console.warn(`[overpass] ${endpoint} returned 0 post_office nodes for "${city}"`)
      }
      return elements
    } catch (err) {
      console.warn(`[overpass] ${endpoint} failed for "${city}":`, err instanceof Error ? err.message : err)
    }
  }
  console.error(`[overpass] all ${OVERPASS_ENDPOINTS.length} endpoints failed for "${city}"`)
  return []
}

async function fetchPochtaApiOffices(city: string): Promise<PochtaOffice[]> {
  try {
    const url = `${POCHTA_BY_ADDRESS}?${new URLSearchParams({ address: city })}`
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      console.warn(`[pochta-api] by-address returned ${res.status} for "${city}"`)
      return []
    }
    const data = await res.json()
    const list = Array.isArray(data) ? data : []
    if (list.length === 0) {
      console.warn(`[pochta-api] by-address returned 0 offices for "${city}"`)
    }
    return list
  } catch (err) {
    console.error(`[pochta-api] by-address failed for "${city}":`, err instanceof Error ? err.message : err)
    return []
  }
}

/**
 * Fetches Russian Post offices for a city.
 * Параллельно тянет Overpass + публичный Pochta API, merge по postal-code.
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
      workTime: tags.opening_hours || pochtaData?.["work-time"] || pochtaData?.workTime || undefined,
      phone:
        tags["contact:phone"] ||
        tags.phone ||
        pochtaData?.["phone-list"]?.[0] ||
        pochtaData?.phoneList?.[0] ||
        undefined,
      carrier: "pochta" as const,
    })
  }

  // Add Pochta API offices that aren't in OSM. Сохраняем даже без координат —
  // frontend покажет их в списке (без маркера на карте).
  for (const o of pochtaOffices) {
    const code = String(o["postal-code"] || o.postalCode || "").trim()
    if (!code || seen.has(code)) continue
    seen.add(code)

    const latRaw = Number(o.latitude)
    const lngRaw = Number(o.longitude)
    const hasCoords = Number.isFinite(latRaw) && Number.isFinite(lngRaw) && (latRaw !== 0 || lngRaw !== 0)

    const address = String(o["address-source"] || o.addressSource || o.address || city)
    points.push({
      code,
      name: `Почтовое отделение ${code}`,
      address,
      lat: hasCoords ? latRaw : 0,
      lng: hasCoords ? lngRaw : 0,
      workTime: o["work-time"] || o.workTime || undefined,
      phone: o["phone-list"]?.[0] || o.phoneList?.[0] || undefined,
      carrier: "pochta" as const,
    })
  }

  const ttl = points.length > 0 ? CACHE_TTL_OK : CACHE_TTL_EMPTY
  cache.set(cacheKey, { expiresAt: now + ttl, points })
  if (points.length === 0) {
    console.warn(
      `[pochta-merge] 0 offices for "${city}" (overpass=${osmNodes.length}, pochta-api=${pochtaOffices.length})`
    )
  }
  return points
}
