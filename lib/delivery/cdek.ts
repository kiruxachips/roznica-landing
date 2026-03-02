import type {
  DeliveryProvider,
  DeliveryRateRequest,
  DeliveryRate,
  PickupPoint,
  CreateShipmentRequest,
  CreateShipmentResult,
  TrackingStatus,
} from "./types"

const PROD_API = "https://api.cdek.ru"
const TEST_API = "https://api.edu.cdek.ru"

// Token cache
let tokenCache: { token: string; expiresAt: number } | null = null

function getApiUrl(testMode: boolean) {
  return testMode ? TEST_API : PROD_API
}

async function getAccessToken(
  clientId: string,
  clientSecret: string,
  testMode: boolean
): Promise<string> {
  const now = Date.now()
  if (tokenCache && now < tokenCache.expiresAt - 60_000) {
    return tokenCache.token
  }

  const url = `${getApiUrl(testMode)}/v2/oauth/token`
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  })

  const res = await fetch(url, {
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

  const res = await fetch(`${apiUrl}${path}`, {
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

      const tariffNames: Record<number, { name: string; type: "pvz" | "door" }> = {
        136: { name: "СДЭК Посылка (склад-склад)", type: "pvz" },
        137: { name: "СДЭК Посылка (склад-дверь)", type: "door" },
        233: { name: "СДЭК Эконом (склад-склад)", type: "pvz" },
        234: { name: "СДЭК Эконом (склад-дверь)", type: "door" },
        138: { name: "СДЭК Посылка (дверь-склад)", type: "pvz" },
        139: { name: "СДЭК Посылка (дверь-дверь)", type: "door" },
      }

      return data.tariff_codes
        .filter((t: { tariff_code: number }) => config.tariffs.includes(t.tariff_code))
        .map((t: { tariff_code: number; delivery_sum: number; period_min: number; period_max: number }) => {
          const info = tariffNames[t.tariff_code] || {
            name: `СДЭК Тариф ${t.tariff_code}`,
            type: t.tariff_code % 2 === 0 ? "door" : "pvz",
          }
          const price = Math.ceil(t.delivery_sum)
          return {
            carrier: "cdek" as const,
            carrierName: "СДЭК",
            tariffCode: t.tariff_code,
            tariffName: info.name,
            deliveryType: info.type,
            price,
            priceWithMarkup: price,
            minDays: t.period_min,
            maxDays: t.period_max,
          }
        })
    },

    async getPickupPoints(cityCode: string): Promise<PickupPoint[]> {
      const data = await cdekFetch(
        `/v2/deliverypoints?city_code=${cityCode}&type=PVZ,POSTAMAT&is_handout=true`,
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
    // Clear cached token to test fresh
    tokenCache = null
    await getAccessToken(clientId, clientSecret, testMode)
    return { success: true }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" }
  }
}
