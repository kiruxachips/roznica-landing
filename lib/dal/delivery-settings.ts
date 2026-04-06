import { prisma } from "@/lib/prisma"

export interface SenderLocation {
  name: string
  city: string
  cityCode: string
  postalCode: string
  isDefault: boolean
}

export function parseSenderLocations(json: string): SenderLocation[] {
  try {
    const arr = JSON.parse(json)
    if (Array.isArray(arr) && arr.length > 0) return arr
  } catch { /* fallback */ }
  return []
}

export function getDefaultSenderLocation(
  settings: Record<string, string>
): SenderLocation {
  const locations = parseSenderLocations(settings.sender_locations || "[]")
  const def = locations.find((l) => l.isDefault) || locations[0]
  if (def) return def

  // Fallback to legacy single-city settings
  return {
    name: settings.sender_city || "Склад",
    city: settings.sender_city || "",
    cityCode: settings.sender_city_code || "",
    postalCode: settings.sender_postal_code || "",
    isDefault: true,
  }
}

// In-memory cache with 60s TTL
let settingsCache: Record<string, string> | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60_000

export async function getDeliverySettings(): Promise<Record<string, string>> {
  const now = Date.now()
  if (settingsCache && now - cacheTimestamp < CACHE_TTL) {
    return settingsCache
  }

  const rows = await prisma.deliverySetting.findMany()
  const map: Record<string, string> = {}
  for (const row of rows) {
    map[row.key] = row.value
  }

  settingsCache = map
  cacheTimestamp = now
  return map
}

export async function getSetting(key: string): Promise<string> {
  const settings = await getDeliverySettings()
  return settings[key] ?? ""
}

export function invalidateSettingsCache() {
  settingsCache = null
  cacheTimestamp = 0
}

export async function getMarkupRules(carrier?: string) {
  const where: Record<string, unknown> = { isActive: true }
  if (carrier) {
    where.carrier = { in: [carrier, "all"] }
  }

  return prisma.deliveryMarkupRule.findMany({
    where,
    orderBy: { sortOrder: "asc" },
  })
}

export async function getDeliveryRules() {
  return prisma.deliveryRule.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  })
}
