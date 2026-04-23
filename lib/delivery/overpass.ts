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
    brand?: string
    operator?: string
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

  // Haversine в метрах — для гео-дедупа. Если OSM-узел без ref ближе 150м
  // к уже добавленной точке с ref (из Pochta API через OSM-match), считаем
  // это одним и тем же отделением.
  const GEO_DEDUP_METERS = 150
  function distMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000
    const toRad = (d: number) => (d * Math.PI) / 180
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  // Фильтр OSM-узлов: убираем чужие (СДЭК/Boxberry/DPD и прочие ПВЗ, которых
  // картографы неверно пометили amenity=post_office) и нормализуем до списка
  // "своих" Pochta-кандидатов с tags/координатами.
  const filteredOsm = osmNodes
    .filter((el) => el.type === "node" && el.lat && el.lon)
    .filter((el) => {
      const brand = (el.tags?.brand || el.tags?.operator || el.tags?.name || "").toLowerCase()
      return !(
        brand.includes("сдэк") ||
        brand.includes("cdek") ||
        brand.includes("boxberry") ||
        brand.includes("pick") /* PickPoint */ ||
        brand.includes("dpd") ||
        brand.includes("wildberries") ||
        brand.includes("ozon") ||
        brand.includes("яндекс") /* Yandex.Dostavka */
      )
    })

  // Индекс OSM-узлов по ref (почтовый индекс) — для merge с Pochta API.
  const osmByRef = new Map<string, OverpassNode>()
  for (const el of filteredOsm) {
    const ref = (el.tags?.ref || "").trim()
    if (ref && !osmByRef.has(ref)) osmByRef.set(ref, el)
  }

  const seen = new Set<string>()
  const points: PickupPoint[] = []

  // 1) Pochta API-записи — каноничные отделения с индексом и адресом. Это
  //    источник правды. Координаты берём: OSM (по ref) → API (lat/lng) → 0.
  for (const o of pochtaOffices) {
    const code = String(o["postal-code"] || o.postalCode || "").trim()
    if (!code || seen.has(code)) continue
    seen.add(code)

    const matchedOsm = osmByRef.get(code)
    const latRaw = Number(o.latitude)
    const lngRaw = Number(o.longitude)
    const hasCoords = Number.isFinite(latRaw) && Number.isFinite(lngRaw) && (latRaw !== 0 || lngRaw !== 0)

    const lat = matchedOsm ? matchedOsm.lat : hasCoords ? latRaw : 0
    const lng = matchedOsm ? matchedOsm.lon : hasCoords ? lngRaw : 0

    const address = String(o["address-source"] || o.addressSource || o.address || city)
    points.push({
      code,
      name: `Почтовое отделение ${code}`,
      address,
      lat,
      lng,
      workTime:
        matchedOsm?.tags?.opening_hours ||
        o["work-time"] ||
        o.workTime ||
        undefined,
      phone:
        matchedOsm?.tags?.["contact:phone"] ||
        matchedOsm?.tags?.phone ||
        o["phone-list"]?.[0] ||
        o.phoneList?.[0] ||
        undefined,
      carrier: "pochta" as const,
    })
  }

  // 2) OSM-узлы, которых нет в Pochta API (по ref). Отбрасываем «пустышки»
  //    (без ref И без уличного адреса) — иначе получаем строки «Почтовое
  //    отделение» без данных. Делаем гео-дедуп: если OSM-узел ближе 150м
  //    к уже добавленному отделению — это тот же физический объект (просто
  //    OSM-картограф не проставил ref).
  for (const el of filteredOsm) {
    const tags = el.tags || {}
    const ref = (tags.ref || "").trim()
    if (ref && seen.has(ref)) continue

    const osmAddr = buildOsmAddress(tags, city)
    const hasUsefulAddress = !!osmAddr
    const nameRaw = (tags.name || "").trim()
    const nameLooksReal = /почт|\bpost|\d{5,6}/i.test(nameRaw) // упоминание "почт" или индекс в name

    // Узел без ref и без адреса и без информативного name — спам, пропускаем
    if (!ref && !hasUsefulAddress && !nameLooksReal) continue

    // Гео-дедуп относительно уже добавленных Pochta-точек с координатами
    const isDuplicate = points.some(
      (p) =>
        p.lat !== 0 &&
        p.lng !== 0 &&
        distMeters(p.lat, p.lng, el.lat, el.lon) < GEO_DEDUP_METERS
    )
    if (isDuplicate) continue

    const code = ref || `osm-${el.id}`
    if (seen.has(code)) continue
    seen.add(code)

    points.push({
      code,
      name: ref
        ? `Почтовое отделение ${ref}`
        : nameRaw && nameRaw.includes("Почт")
          ? nameRaw
          : nameRaw
            ? `Почтовое отделение ${nameRaw}`
            : "Почтовое отделение",
      address: osmAddr || city,
      lat: el.lat,
      lng: el.lon,
      workTime: tags.opening_hours || undefined,
      phone: tags["contact:phone"] || tags.phone || undefined,
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
