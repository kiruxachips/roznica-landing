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
import { distributeItemsToPackages } from "./packaging"

const PROD_API = "https://api.cdek.ru"
const TEST_API = "https://api.edu.cdek.ru"

/**
 * Тип доставки по коду тарифа СДЭК (из официального справочника).
 * Мы смотрим ТОЛЬКО на конечную точку (куда приходит посылка получателю):
 * - "дверь" или "постамат" → door (курьер на адрес)
 * - "склад" → pvz (самовывоз из ПВЗ)
 *
 * Маппинг через `delivery_mode` из ответа API ненадёжен: для некоторых
 * тарифов CDEK возвращает противоречивые значения. Код тарифа — истина.
 */
const CDEK_TARIFF_TYPE: Record<number, "door" | "pvz"> = {
  // Обычная посылка
  136: "pvz",  // склад-склад
  137: "door", // склад-дверь
  138: "pvz",  // дверь-склад
  139: "door", // дверь-дверь
  366: "door", // дверь-постамат
  368: "pvz",  // склад-постамат → формально постамат, трактуем как pvz
  // Экономичная посылка
  231: "door", // дверь-дверь
  232: "pvz",  // дверь-склад
  233: "door", // склад-дверь
  234: "pvz",  // склад-склад
  376: "door", // дверь-постамат
  378: "pvz",  // склад-постамат
  // Экспресс
  480: "door", 481: "pvz", 482: "door", 483: "pvz",
  485: "door", 486: "door",
  605: "door", 606: "pvz", 607: "door",
  // Магистральный экспресс
  121: "door", 123: "pvz", 122: "door", 62: "pvz",
  522: "door", 523: "pvz",
  // Супер-экспресс
  706: "door", 707: "pvz", 708: "door", 709: "pvz", 711: "door", 712: "pvz",
  716: "door", 717: "pvz", 718: "door", 719: "pvz", 721: "door", 722: "pvz",
  // Возврат
  140: "pvz", 141: "door",
  // Старые коды
  291: "pvz", 293: "door", 294: "pvz", 295: "door",
}

/**
 * Человекочитаемые имена тарифов для карточки в checkout.
 * Формат: «СДЭК [вариант] — [как получает клиент]».
 */
const CDEK_TARIFF_NAMES: Record<number, string> = {
  136: "СДЭК — в пункт выдачи",
  137: "СДЭК — до двери",
  138: "СДЭК — в пункт выдачи",
  139: "СДЭК — до двери",
  366: "СДЭК — до двери",
  368: "СДЭК — в постамат",
  231: "СДЭК Эконом — до двери",
  232: "СДЭК Эконом — в пункт выдачи",
  233: "СДЭК Эконом — до двери",
  234: "СДЭК Эконом — в пункт выдачи",
  376: "СДЭК Эконом — до двери",
  378: "СДЭК Эконом — в постамат",
  480: "СДЭК Экспресс — до двери",
  481: "СДЭК Экспресс — в пункт выдачи",
  482: "СДЭК Экспресс — до двери",
  483: "СДЭК Экспресс — в пункт выдачи",
  706: "СДЭК Супер-экспресс до 16:00 — до двери",
  707: "СДЭК Супер-экспресс до 16:00 — в пункт выдачи",
  708: "СДЭК Супер-экспресс до 16:00 — до двери",
  709: "СДЭК Супер-экспресс до 16:00 — в пункт выдачи",
  716: "СДЭК Супер-экспресс до 18:00 — до двери",
  717: "СДЭК Супер-экспресс до 18:00 — в пункт выдачи",
  718: "СДЭК Супер-экспресс до 18:00 — до двери",
  719: "СДЭК Супер-экспресс до 18:00 — в пункт выдачи",
  121: "СДЭК Магистральный экспресс — до двери",
  122: "СДЭК Магистральный экспресс — до двери",
  123: "СДЭК Магистральный экспресс — в пункт выдачи",
  62: "СДЭК Магистральный экспресс — в пункт выдачи",
  291: "СДЭК — в пункт выдачи",
  293: "СДЭК — до двери",
  294: "СДЭК — в пункт выдачи",
  295: "СДЭК — до двери",
}

/**
 * Определение типа доставки: сначала наша таблица по коду,
 * потом парсинг имени тарифа из ответа API (на случай новых кодов),
 * в крайнем случае — delivery_mode (ненадёжный fallback).
 */
function deliveryTypeFor(
  tariffCode: number,
  tariffName: string | undefined,
  deliveryMode: number | undefined
): "door" | "pvz" {
  const mapped = CDEK_TARIFF_TYPE[tariffCode]
  if (mapped) return mapped

  if (tariffName) {
    const name = tariffName.toLowerCase()
    // Ключевые слова — для конечного сегмента (последняя часть после дефиса)
    const lastSegment = name.split("-").pop() || name
    if (lastSegment.includes("дверь") || lastSegment.includes("постамат")) return "door"
    if (lastSegment.includes("склад")) return "pvz"
  }

  // CDEK delivery_mode: 1=дверь-дверь, 2=дверь-склад, 3=склад-дверь, 4=склад-склад,
  // 6=дверь-постамат, 7=склад-постамат, 8=постамат-дверь, 9=постамат-склад, 10=постамат-постамат
  if (deliveryMode === 1 || deliveryMode === 3 || deliveryMode === 6 || deliveryMode === 7 || deliveryMode === 8) {
    return "door"
  }
  return "pvz"
}

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

// Circuit breaker защищает от cascade-timeout'ов когда CDEK API лежит.
// Без breaker'а каждый запрос ждёт fetchWithTimeout 10с — при 20 юзерах
// на checkout получаем 200с суммарной задержки и UX деградирует.
// С breaker'ом после 5 подряд фейлов в 60-секундном окне все запросы
// мгновенно падают с 5-минутным cooldown'ом.
import { createCircuitBreaker, CircuitBreakerOpenError } from "@/lib/circuit-breaker"

const cdekBreaker = createCircuitBreaker({
  name: "cdek",
  failureThreshold: 5,
  windowMs: 60_000,
  cooldownMs: 5 * 60_000,
})

export { CircuitBreakerOpenError as CdekBreakerOpen }

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
  return cdekBreaker.run(async () => {
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
  })
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
      if (!req.packages || req.packages.length === 0) return []

      const body = {
        from_location: { code: parseInt(config.senderCityCode) || undefined },
        to_location: {
          code: req.toCityCode ? parseInt(req.toCityCode) : undefined,
          postal_code: req.toPostalCode || undefined,
        },
        packages: req.packages.map((p) => ({
          weight: p.weight,
          length: p.length,
          width: p.width,
          height: p.height,
        })),
      }

      // Graceful degradation: если circuit breaker открыт или СДЭК отвечает
      // ошибкой — возвращаем [] вместо throw. Вызывающий код (index.ts)
      // делает Promise.allSettled и показывает юзеру только Почту.
      // Это лучше чем показ "ошибка доставки" — хотя бы один способ работает.
      let data: { tariff_codes?: unknown[] }
      try {
        data = await cdekFetch("/v2/calculator/tarifflist", {
          ...opts,
          method: "POST",
          body,
        })
      } catch (e) {
        console.error("[cdek.calculateRates] failed:", e instanceof Error ? e.message : e)
        return []
      }

      if (!data.tariff_codes) return []

      return (data.tariff_codes as Array<{
        tariff_code: number
        tariff_name?: string
        delivery_mode: number
        delivery_sum: number
        period_min: number
        period_max: number
      }>)
        .filter((t: { tariff_code: number }) => config.tariffs.includes(t.tariff_code))
        .map((t: { tariff_code: number; tariff_name?: string; delivery_mode: number; delivery_sum: number; period_min: number; period_max: number }) => {
          const price = Math.ceil(t.delivery_sum)
          const deliveryType = deliveryTypeFor(t.tariff_code, t.tariff_name, t.delivery_mode)
          return {
            carrier: "cdek" as const,
            carrierName: "СДЭК",
            tariffCode: t.tariff_code,
            tariffName: CDEK_TARIFF_NAMES[t.tariff_code] || t.tariff_name || `СДЭК Тариф ${t.tariff_code}`,
            deliveryType,
            price,
            priceWithMarkup: price,
            minDays: t.period_min,
            maxDays: t.period_max,
          }
        })
    },

    async getPickupPoints(cityCode: string): Promise<PickupPoint[]> {
      let data: unknown
      try {
        data = await cdekFetch(
          `/v2/deliverypoints?city_code=${cityCode}&type=ALL&is_handout=true`,
          opts
        )
      } catch (e) {
        console.error("[cdek.getPickupPoints] failed:", e instanceof Error ? e.message : e)
        return []
      }

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
      if (!req.packages || req.packages.length === 0) {
        throw new Error("CDEK createShipment: пустой план упаковки")
      }

      // Распределяем позиции заказа по физическим коробкам плана упаковки.
      // Для одиночной коробки все позиции в неё; для мультикоробки — bin-packing по весу.
      const perBoxItems = distributeItemsToPackages(req.items, req.packages)

      // ware_key должен быть уникален в рамках всего заказа, не только коробки
      let wareCounter = 0

      const body: Record<string, unknown> = {
        tariff_code: req.tariffCode,
        from_location: { code: parseInt(req.senderCityCode) },
        recipient: {
          name: req.recipientName,
          phones: [{ number: req.recipientPhone }],
        },
        packages: req.packages.map((p, idx) => {
          const items = (perBoxItems[idx] || []).map((item) => ({
            name: item.name,
            ware_key: `item_${wareCounter++}`,
            payment: { value: 0 },
            cost: item.price,
            weight: item.weight,
            amount: item.quantity,
          }))
          // На случай, если коробка пустая (не должно случаться, но защищаемся):
          // CDEK требует минимум один item per package.
          if (items.length === 0) {
            items.push({
              name: "Дополнительное грузовое место",
              ware_key: `extra_${wareCounter++}`,
              payment: { value: 0 },
              cost: 0,
              weight: p.weight,
              amount: 1,
            })
          }
          return {
            number: String(idx + 1),
            weight: p.weight,
            length: p.length,
            width: p.width,
            height: p.height,
            items,
          }
        }),
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
