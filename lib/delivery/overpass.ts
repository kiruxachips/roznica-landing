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

function escapeOverpass(s: string): string {
  return s.replace(/"/g, '\\"')
}

/** Нормализация имени региона из DaData → название как в OSM.
 * DaData отдаёт "Калининградская" (без " область"), OSM хранит
 * "Калининградская область". Добавляем суффикс, если короткое. */
function osmRegionName(region: string): string[] {
  const trimmed = region.trim()
  if (!trimmed) return []
  // Частые суффиксы: "область", "край", "республика", "АО", "округ"
  // Если уже содержит — возвращаем как есть; иначе предлагаем варианты.
  const lower = trimmed.toLowerCase()
  if (/(область|край|республика|автономн|округ|г\.)/.test(lower)) {
    return [trimmed]
  }
  // Для типовых "Калининградская" / "Московская" / "Кемеровская" — область
  if (/(ская|цкая|ская$|ая|зская)$/.test(lower)) {
    return [`${trimmed} область`, trimmed]
  }
  return [trimmed]
}

async function fetchOverpassPoints(city: string, region?: string): Promise<OverpassNode[]> {
  // Расширенный запрос: ищем area по нескольким подходящим admin_level и
  // вариантам place-tag — для малых городов Подмосковья area может быть
  // оформлена как city/town/village/suburb, а не только admin_level 4/6/8.
  const escapedCity = escapeOverpass(city)

  // Если регион задан — сужаем поиск в его area (разрешает однофамильные города:
  // Гурьевск Калининградский vs Кемеровский).
  let query: string
  if (region && region.trim()) {
    const regionCandidates = osmRegionName(region).map(escapeOverpass)
    const regionUnion = regionCandidates
      .flatMap((r) => [
        `  area["name"="${r}"]["admin_level"~"^[234]$"];`,
        `  area["name:ru"="${r}"]["admin_level"~"^[234]$"];`,
      ])
      .join("\n")
    query = `[out:json][timeout:25];
(
${regionUnion}
)->.region;
(
  area["name"="${escapedCity}"](area.region)["admin_level"~"^[468]$"];
  area["name:ru"="${escapedCity}"](area.region)["admin_level"~"^[468]$"];
  area["name"="${escapedCity}"](area.region)["place"~"city|town|village|suburb"];
  area["name:ru"="${escapedCity}"](area.region)["place"~"city|town|village|suburb"];
)->.a;
node(area.a)["amenity"="post_office"];
out body 500;`
  } else {
    query = `[out:json][timeout:25];
(
  area["name"="${escapedCity}"]["admin_level"~"^[468]$"];
  area["name:ru"="${escapedCity}"]["admin_level"~"^[468]$"];
  area["name"="${escapedCity}"]["place"~"city|town|village|suburb"];
  area["name:ru"="${escapedCity}"]["place"~"city|town|village|suburb"];
)->.a;
node(area.a)["amenity"="post_office"];
out body 500;`
  }

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

async function fetchPochtaApiOffices(city: string, region?: string): Promise<PochtaOffice[]> {
  // Собираем "регион, город" — публичный API лучше разрешает одноимённые
  // города когда передан контекст региона. Fallback: просто город.
  const addressQueries: string[] = []
  if (region && region.trim()) {
    addressQueries.push(`${region.trim()}, ${city}`)
  }
  addressQueries.push(city)

  for (const address of addressQueries) {
    try {
      const url = `${POCHTA_BY_ADDRESS}?${new URLSearchParams({ address })}`
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      })
      if (!res.ok) {
        console.warn(`[pochta-api] by-address returned ${res.status} for "${address}"`)
        continue
      }
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      if (list.length > 0) return list
      console.warn(`[pochta-api] by-address returned 0 offices for "${address}"`)
    } catch (err) {
      console.error(`[pochta-api] by-address failed for "${address}":`, err instanceof Error ? err.message : err)
    }
  }
  return []
}

/**
 * Fetches Russian Post offices for a city.
 * Параллельно тянет Overpass + публичный Pochta API, merge по postal-code.
 *
 * @param options.region — нужен для disambiguation одноимённых городов
 *   (Гурьевск Калининградский vs Кемеровский). Используется и в Overpass
 *   (узкая area), и в Pochta API (address=«Регион, Город»).
 * @param options.postalCode — индекс. Первые 3 цифры = региональный сорт-центр
 *   Почты. Используется как префиксный фильтр для отсечения офисов «чужого»
 *   одноимённого города, если region не найдён в OSM.
 */
export async function getPochtaOfficesByCity(
  city: string,
  options?: { region?: string; postalCode?: string }
): Promise<PickupPoint[]> {
  if (!city) return []

  const region = (options?.region || "").trim()
  const postalCode = (options?.postalCode || "").trim()
  // Первые 3 цифры индекса однозначно определяют регион Почты (238xxx =
  // Калининград, 652xxx = Кемерово, 141xxx = Подмосковье-север и т.д.).
  const postalPrefix = /^\d{3}/.test(postalCode) ? postalCode.slice(0, 3) : ""

  // Cache key включает disambiguating-параметры — иначе один "Гурьевск"
  // бы забивал кэш и для Калининградского, и для Кемеровского.
  const cacheKey = [
    city.toLowerCase().trim(),
    region.toLowerCase(),
    postalPrefix,
  ].join("|")
  const now = Date.now()
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.points
  }

  const [osmNodesRaw, pochtaOfficesRaw] = await Promise.all([
    fetchOverpassPoints(city, region || undefined),
    fetchPochtaApiOffices(city, region || undefined),
  ])

  // Пост-фильтрация по префиксу индекса: отсекает "чужие" одноимённые города,
  // даже если Overpass/PochtaAPI игнорировали region-контекст.
  const pochtaOffices = postalPrefix
    ? pochtaOfficesRaw.filter((o) => {
        const code = String(o["postal-code"] || o.postalCode || "").trim()
        return code.startsWith(postalPrefix)
      })
    : pochtaOfficesRaw

  const osmNodes = postalPrefix
    ? osmNodesRaw.filter((el) => {
        const ref = (el.tags?.ref || "").trim()
        const postcode = String((el.tags as any)?.["addr:postcode"] || "").trim()
        // Если у узла есть ref — он должен совпасть с префиксом региона.
        if (ref) return ref.startsWith(postalPrefix)
        // Если есть addr:postcode — аналогично.
        if (postcode) return postcode.startsWith(postalPrefix)
        // Иначе — не можем определить. Если region был задан, Overpass уже
        // ограничил выдачу; пропускаем. Если нет — строгий отказ (иначе
        // появляются узлы из чужого города без ref).
        return region.length > 0
      })
    : osmNodesRaw

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
  //    Адрес: OSM (если полный — улица+дом) → Pochta API → город-строка.
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

    // Приоритет адреса: детальный OSM (улица+дом) → Pochta API → OSM-частичный → город.
    // Публичный API часто возвращает просто "Гурьевск" без улицы — если у нас есть
    // более точный адрес из OSM, используем его.
    const osmFullAddr = matchedOsm ? buildOsmAddress(matchedOsm.tags, city) : ""
    const osmHasStreet =
      !!matchedOsm?.tags?.["addr:street"] && !!matchedOsm?.tags?.["addr:housenumber"]
    const pochtaAddr = String(o["address-source"] || o.addressSource || o.address || "").trim()
    const address =
      (osmHasStreet ? osmFullAddr : "") ||
      pochtaAddr ||
      osmFullAddr ||
      city
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

  // 2) OSM-узлы, которых нет в Pochta API (по ref). Ужесточённый фильтр:
  //    - должен быть ЛИБО ref (индекс), ЛИБО полноценный адрес (улица + дом).
  //      Просто «amenity=post_office + name=Почта» без локализации — мусор.
  //    - гео-дедуп: если OSM-узел ближе 150м к уже добавленному (как из
  //      Pochta API, так и из предыдущего OSM-узла) — один физический
  //      объект, где картограф не проставил ref.
  for (const el of filteredOsm) {
    const tags = el.tags || {}
    const ref = (tags.ref || "").trim()
    if (ref && seen.has(ref)) continue

    const osmAddr = buildOsmAddress(tags, city)
    const hasStreetAddress =
      !!tags["addr:street"] && !!tags["addr:housenumber"]

    // Требуем явный источник идентификации: индекс ИЛИ улица+дом.
    // Без этого в списке клиент видит «Почта / Гурьевск» без адреса — бесполезно.
    if (!ref && !hasStreetAddress) continue

    // Гео-дедуп относительно ВСЕХ уже добавленных точек (включая OSM из этого
    // же цикла), не только Pochta API-записей с координатами.
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

    const nameRaw = (tags.name || "").trim()
    points.push({
      code,
      name: ref
        ? `Почтовое отделение ${ref}`
        : nameRaw && nameRaw.toLowerCase().includes("почт")
          ? nameRaw
          : "Почтовое отделение",
      address: osmAddr,
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
      `[pochta-merge] 0 offices for "${city}" (region="${region}", prefix="${postalPrefix}", ` +
      `overpass-raw=${osmNodesRaw.length}, overpass-filt=${osmNodes.length}, ` +
      `pochta-raw=${pochtaOfficesRaw.length}, pochta-filt=${pochtaOffices.length})`
    )
  }
  return points
}
