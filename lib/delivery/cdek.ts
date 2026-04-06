import type {
  DeliveryProvider,
  DeliveryRateRequest,
  DeliveryRate,
  PickupPoint,
  CreateShipmentRequest,
  CreateShipmentResult,
  TrackingStatus,
} from "./types"
import { fetchWithTimeout } from "./utils"

const PROD_API = "https://api.cdek.ru"
const TEST_API = "https://api.edu.cdek.ru"

// Token cache keyed by credentials, so changing creds in admin invalidates it
let tokenCache: { key: string; token: string; expiresAt: number } | null = null

function getApiUrl(testMode: boolean) {
  return testMode ? TEST_API : PROD_API
}

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  testMode: boolean
): Promise<string> {
  const now = Date.now()
  const cacheKey = `${clientId}:${testMode}`
  if (tokenCache && tokenCache.key === cacheKey && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.token
  }

  const url = `${getApiUrl(testMode)}/v2/oauth/token`
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`CDEK OAuth error ${res.status}: ${text}`)
  }

  const data = await res.json()
  tokenCache = {
    key: cacheKey,
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  }
  return data.access_token
}

async function cdekFetch(
  path: string,
  options: {
    method?: string
    body?: unknown
    clientId: string
    clientSecret: string
    testMode: boolean
  }
) {
  const token = await getAccessToken(options.clientId, options.clientSecret, options.testMode)
  const apiUrl = getApiUrl(options.testMode)

  const res = await fetchWithTimeout(`${apiUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`CDEK API error ${res.status}: ${text}`)
  }

  return res.json()
}

/** Shared CDEK fetch with auth + timeout. Exported for city-search. */
export { cdekFetch, getApiUrl }

export function createCdekProvider(config: {
  clientId: string
  clientSecret: string
  testMode: boolean
  tariffs: number[]
  senderCityCode: string
}): DeliveryProvider {
  const opts = {
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    testMode: config.testMode,
  }

  return {
    carrier: "cdek",

    async calculateRates(req: DeliveryRateRequest): Promise<DeliveryRate[]> {
      const body = {
        from_location: { code: parseInt(config.senderCityCode) || undefined },
        to_location: {
          code: req.toCityCode ? parseInt(req.toCityCode) : undefined,
          postal_code: req.toPostalCode || undefined,
        },
        packages: [
          {
            weight: req.weight,
            length: req.length || 20,
            width: req.width || 15,
            height: req.height || 10,
          },
        ],
      }

      const data = await cdekFetch("/v2/calculator/tarifflist", {
        ...opts,
        method: "POST",
        body,
      })

      if (!data.tariff_codes) return []

      // delivery_mode from CDEK API: 1=door-door, 2=door-pvz, 3=pvz-door, 4=pvz-pvz
      // We care about the destination part: modes 1,3 → door, modes 2,4 → pvz
      function deliveryTypeFromMode(mode?: number): "pvz" | "door" {
        if (mode === 1 || mode === 3) return "door"
        return "pvz" // modes 2, 4, or unknown default to pvz
      }

      // Human-readable names for well-known tariffs
      const tariffNames: Record<number, string> = {
        136: "СДЭК — забрать из пункта выдачи",
        137: "СДЭК — доставка до двери",
        138: "СДЭК — забрать из пункта выдачи",
        139: "СДЭК — доставка до двери",
        233: "СДЭК Эконом — забрать из пункта выдачи",
        234: "СДЭК Эконом — доставка до двери",
        291: "СДЭК — забрать из пункта выдачи",
        293: "СДЭК — доставка до двери",
        294: "СДЭК — забрать из пункта выдачи",
        295: "СДЭК — доставка до двери",
      }

      return data.tariff_codes
        .filter((t: { tariff_code: number }) => config.tariffs.includes(t.tariff_code))
        .map((t: { tariff_code: number; tariff_name?: string; delivery_mode: number; delivery_sum: number; period_min: number; period_max: number }) => {
          const price = Math.ceil(t.delivery_sum)
          return {
            carrier: "cdek" as const,
            carrierName: "СДЭК",
            tariffCode: t.tariff_code,
            tariffName: tariffNames[t.tariff_code] || t.tariff_name || `СДЭК Тариф ${t.tariff_code}`,
            deliveryType: deliveryTypeFromMode(t.delivery_mode),
            price,
            priceWithMarkup: price,
            minDays: t.period_min,
            maxDays: t.period_max,
          }
        })
    },

    async getPickupPoints(cityCode: string): Promise<PickupPoint[]> {
      const data = await cdekFetch(
        `/v2/deliverypoints?city_code=${cityCode}&type=ALL&is_handout=true`,
        opts
      )

      if (!Array.isArray(data)) return []

      return data.map(
        (p: {
          code: string
          name: string
          location: { address: string; latitude: number; longitude: number }
          phones?: { number: string }[]
          work_time?: string
        }) => ({
          code: p.code,
          name: p.name,
          address: p.location?.address || "",
          lat: p.location?.latitude || 0,
          lng: p.location?.longitude || 0,
          phone: p.phones?.[0]?.number,
          workTime: p.work_time,
          carrier: "cdek" as const,
        })
      )
    },

    async createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult> {
      const body: Record<string, unknown> = {
        tariff_code: req.tariffCode,
        from_location: { code: parseInt(req.senderCityCode) },
        recipient: {
          name: req.recipientName,
          phones: [{ number: req.recipientPhone }],
        },
        packages: [
          {
            number: "1",
            weight: req.weight,
            length: req.length,
            width: req.width,
            height: req.height,
            items: req.items.map((item, i) => ({
              name: item.name,
              ware_key: `item_${i}`,
              payment: { value: 0 },
              cost: item.price,
              weight: item.weight,
              amount: item.quantity,
            })),
          },
        ],
      }

      if (req.deliveryType === "pvz" && req.pickupPointCode) {
        body.to_location = { code: parseInt(req.recipientCityCode || "0") }
        body.delivery_point = req.pickupPointCode
      } else {
        body.to_location = {
          code: parseInt(req.recipientCityCode || "0"),
          address: req.recipientAddress,
        }
      }

      const data = await cdekFetch("/v2/orders", { ...opts, method: "POST", body })

      return {
        carrierOrderId: data.entity?.uuid || "",
        carrierOrderNum: data.entity?.cdek_number?.toString() || undefined,
        trackingNumber: data.entity?.cdek_number?.toString() || undefined,
      }
    },

    async getTrackingStatus(carrierOrderId: string): Promise<TrackingStatus[]> {
      const data = await cdekFetch(`/v2/orders/${carrierOrderId}`, opts)

      if (!data.entity?.statuses) return []

      return data.entity.statuses.map(
        (s: { code: string; name: string; date_time: string; city_name?: string }) => ({
          code: s.code,
          name: s.name,
          date: s.date_time,
          cityName: s.city_name,
        })
      )
    },
  }
}

// Test connection helper
export async function testCdekConnection(
  clientId: string,
  clientSecret: string,
  testMode: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    // Clear cached token for these credentials to test fresh
    if (tokenCache?.key === `${clientId}:${testMode}`) {
      tokenCache = null
    }
    await getAccessToken(clientId, clientSecret, testMode)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
  }
}
