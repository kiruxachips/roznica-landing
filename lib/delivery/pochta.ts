import { fetchWithTimeout } from "./utils"
import { getPostalCodeForCity } from "./dadata"
import { logIntegration } from "@/lib/dal/integration-log"
import type {
  DeliveryProvider,
  DeliveryRateRequest,
  DeliveryRate,
  Package,
  PickupPoint,
  CreateShipmentRequest,
  CreateShipmentResult,
  TrackingStatus,
} from "./types"

// Pochta RF tariff API (open, no auth)
const TARIFF_API = "https://tariff.pochta.ru/tariff/v1/calculate"
const DELIVERY_API = "https://delivery.pochta.ru/delivery/v1/calculate"
const OTPRAVKA_API = "https://otpravka-api.pochta.ru"
const TRACKING_API = "https://tracking.pochta.ru/rtm34"
const POCHTA_PVZ_TARIFF_OFFSET = 100000

/**
 * Считает цену Почты РФ для одной физической коробки. Возвращает null при ошибке.
 * Также возвращает сроки (минимум/максимум в днях), если удалось получить.
 */
async function calculateSinglePackagePrice(params: {
  objectType: number
  senderPostalCode: string
  toPostalCode: string
  pkg: Package
  date: string
}): Promise<{ price: number; minDays: number; maxDays: number } | null> {
  const { objectType, senderPostalCode, toPostalCode, pkg, date } = params
  const qs = new URLSearchParams({
    object: objectType.toString(),
    from: senderPostalCode,
    to: toPostalCode,
    weight: pkg.weight.toString(),
    group: "0",
    closed: "1",
    date,
  })

  const dimension = Math.max(pkg.length, pkg.width, pkg.height)
  qs.set("dimension", `${pkg.length}x${pkg.width}x${pkg.height}`)
  qs.set("dimensiontype", dimension > 60 ? "0" : "1")

  try {
    const [tariffRes, deliveryRes] = await Promise.allSettled([
      fetchWithTimeout(`${TARIFF_API}?${qs}`),
      fetchWithTimeout(
        `${DELIVERY_API}?${new URLSearchParams({
          object: objectType.toString(),
          from: senderPostalCode,
          to: toPostalCode,
        })}`
      ),
    ])

    if (tariffRes.status !== "fulfilled" || !tariffRes.value.ok) {
      const reason = tariffRes.status === "rejected" ? tariffRes.reason : `HTTP ${tariffRes.value.status}`
      console.error("Pochta tariff API failed:", reason)
      // P2-8: пишем в audit-trail для админа — чтобы видеть когда API падает
      void logIntegration({
        direction: "outbound",
        source: "pochta",
        event: "tariff.calculate",
        error: String(reason).slice(0, 4000),
        statusCode: tariffRes.status === "fulfilled" ? tariffRes.value.status : null,
      })
      return null
    }

    const tariffData = await tariffRes.value.json()
    // Pochta returns price in kopecks
    const priceRub = Math.ceil((tariffData.ground?.val || tariffData.paynds || 0) / 100)

    let minDays = 5
    let maxDays = 14
    if (deliveryRes.status === "fulfilled" && deliveryRes.value.ok) {
      const data = await deliveryRes.value.json()
      minDays = data.delivery?.min || 5
      maxDays = data.delivery?.max || 14
    }

    return { price: priceRub, minDays, maxDays }
  } catch (e) {
    console.error("Pochta calculateSinglePackagePrice error:", e)
    void logIntegration({
      direction: "outbound",
      source: "pochta",
      event: "tariff.calculate",
      error: e instanceof Error ? e.message : String(e),
    })
    return null
  }
}

export function createPochtaProvider(config: {
  accessToken?: string
  userAuth?: string
  trackingLogin?: string
  trackingPassword?: string
  objectType: number // 47030 = посылка нестандартная
  senderPostalCode: string
  dadataApiKey?: string
}): DeliveryProvider {
  return {
    carrier: "pochta",

    async calculateRates(req: DeliveryRateRequest): Promise<DeliveryRate[]> {
      if (!config.senderPostalCode) {
        console.warn("Pochta: senderPostalCode not configured, skipping rate calculation")
        return []
      }

      if (!req.packages || req.packages.length === 0) return []

      let postalCode = req.toPostalCode

      // If no postal code provided, try to look up from city name.
      // Prefer DaData (reliable, structured) over Pochta's legacy by-address endpoint.
      if (!postalCode && req.toCity) {
        if (config.dadataApiKey) {
          try {
            postalCode = await getPostalCodeForCity(config.dadataApiKey, req.toCity, req.toRegion)
          } catch {
            // continue to fallback
          }
        }

        if (!postalCode) {
          try {
            const lookupRes = await fetchWithTimeout(
              `https://api.pochta.ru/postoffice/1.0/by-address?${new URLSearchParams({ address: req.toCity })}`,
              {},
              5000
            )
            if (lookupRes.ok) {
              const offices = await lookupRes.json()
              if (Array.isArray(offices) && offices.length > 0) {
                postalCode = String(offices[0]?.["postal-code"] || offices[0]?.postalCode || "")
              }
            }
          } catch {
            // Still no postal code — return empty below
          }
        }
      }

      if (!postalCode) return []

      // Считаем цену для КАЖДОЙ коробки и суммируем. Сроки берём как max по коробкам
      // (заказ доедет не раньше, чем доедет самая «медленная» посылка).
      const date = new Date().toISOString().slice(0, 8) + "01"
      const results = await Promise.all(
        req.packages.map((pkg) =>
          calculateSinglePackagePrice({
            objectType: config.objectType,
            senderPostalCode: config.senderPostalCode,
            toPostalCode: postalCode as string,
            pkg,
            date,
          })
        )
      )

      // Если хоть одна коробка не рассчиталась — всю доставку считаем недоступной,
      // чтобы клиент не получил неполную цену (лучше «нет тарифа», чем «недоплата»).
      if (results.some((r) => r === null)) return []

      const valid = results as { price: number; minDays: number; maxDays: number }[]
      const totalPrice = valid.reduce((s, r) => s + r.price, 0)
      const minDays = Math.max(...valid.map((r) => r.minDays))
      const maxDays = Math.max(...valid.map((r) => r.maxDays))

      return [
        {
          carrier: "pochta",
          carrierName: "Почта России",
          tariffCode: config.objectType,
          tariffName: "Почта России — До двери",
          deliveryType: "door",
          price: totalPrice,
          priceWithMarkup: totalPrice,
          minDays,
          maxDays,
        },
        {
          carrier: "pochta",
          carrierName: "Почта России",
          tariffCode: config.objectType + POCHTA_PVZ_TARIFF_OFFSET,
          tariffName: "Почта России — До отделения",
          deliveryType: "pvz",
          price: totalPrice,
          priceWithMarkup: totalPrice,
          minDays: Math.max(minDays - 1, 1),
          maxDays: Math.max(maxDays - 1, minDays),
        },
      ]
    },

    async getPickupPoints(
      cityName: string,
      options?: { region?: string; postalCode?: string }
    ): Promise<PickupPoint[]> {
      if (!cityName) return []

      // Primary: OSM Overpass + публичный Pochta API параллельно, merged по индексу.
      // region/postalCode помогают disambiguation одноимённых городов
      // (Гурьевск Калининградский vs Кемеровский).
      try {
        const { getPochtaOfficesByCity } = await import("./overpass")
        const points = await getPochtaOfficesByCity(cityName, options)
        if (points.length > 0) return points
      } catch (e) {
        console.error("Pochta getPickupPoints (Overpass+PublicAPI) failed:", e)
      }

      // Fallback: authenticated Otpravka API if tokens are configured. Вступает в
      // игру только если primary вернул пусто И токены настроены (обычно только
      // для заведённой интеграции).
      if (config.accessToken && config.userAuth) {
        try {
          const res = await fetchWithTimeout(
            `${OTPRAVKA_API}/1.0/postoffice/1.0/by-address?${new URLSearchParams({ address: cityName })}`,
            {
              headers: {
                Authorization: `AccessToken ${config.accessToken}`,
                "X-User-Authorization": `Basic ${config.userAuth}`,
                Accept: "application/json;charset=UTF-8",
              },
            },
            8000
          )
          if (res.ok) {
            const data = await res.json()
            const offices: unknown[] = Array.isArray(data) ? data : []
            const points = offices
              .filter((o: any) => o.latitude && o.longitude)
              .map((o: any) => ({
                code: String(o["postal-code"] || o.postalCode || ""),
                name: `Почтовое отделение ${o["postal-code"] || o.postalCode || ""}`,
                address: o["address-source"] || o.addressSource || o.address || "",
                lat: Number(o.latitude),
                lng: Number(o.longitude),
                workTime: o["work-time"] || o.workTime || undefined,
                phone: o["phone-list"]?.[0] || o.phoneList?.[0] || undefined,
                carrier: "pochta" as const,
              }))
            if (points.length > 0) return points
          }
        } catch (e) {
          console.error("Pochta getPickupPoints (Otpravka) failed:", e)
        }
      }

      return []
    },

    async createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult> {
      if (!config.accessToken || !config.userAuth) {
        throw new Error("Pochta RF API tokens not configured")
      }
      if (!req.packages || req.packages.length === 0) {
        throw new Error("Pochta createShipment: пустой план упаковки")
      }

      // Формируем по одной записи в backlog на каждую физическую коробку.
      // У Почты каждая коробка = отдельный трек-номер.
      const body = req.packages.map((pkg, idx) => ({
        "address-type-to": "DEFAULT",
        "given-name": req.recipientName.split(" ")[0] || req.recipientName,
        "house-to": "",
        "index-to":
          req.deliveryType === "pvz" && req.pickupPointCode
            ? parseInt(req.pickupPointCode)
            : parseInt(req.recipientPostalCode || "0"),
        "mail-category": "ORDINARY",
        "mail-direct": 643,
        "mail-type": "POSTAL_PARCEL",
        "mass": pkg.weight,
        "order-num": req.packages.length > 1 ? `${req.orderId}-${idx + 1}` : req.orderId,
        "place-to": req.recipientAddress || "",
        "postoffice-code": config.senderPostalCode,
        "recipient-name": req.recipientName,
        "str-index-to": req.recipientPostalCode || "",
        "tel-address": parseInt(req.recipientPhone.replace(/\D/g, "")),
        "dimension": {
          height: pkg.height * 10, // mm
          length: pkg.length * 10,
          width: pkg.width * 10,
        },
      }))

      const res = await fetchWithTimeout(`${OTPRAVKA_API}/1.0/user/backlog`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          Authorization: `AccessToken ${config.accessToken}`,
          "X-User-Authorization": `Basic ${config.userAuth}`,
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Pochta API error ${res.status}: ${text}`)
      }

      const data = await res.json()
      const ids: string[] = (data.result_ids || []).map((r: unknown) => String(r))
      const barcodes: string[] = (data.barcode || []).map((b: unknown) => String(b))

      return {
        // Если коробок несколько — соединяем id и трек-номера через запятую
        carrierOrderId: ids.join(",") || "",
        trackingNumber: barcodes.length > 0 ? barcodes.join(",") : undefined,
      }
    },

    async getTrackingStatus(barcode: string): Promise<TrackingStatus[]> {
      if (!config.trackingLogin || !config.trackingPassword || !barcode) return []

      // Для мультикоробочных отправок трек-номера сохраняются через запятую;
      // Берём первый (можно расширить до аггрегации, но статусы обычно синхронны).
      const firstBarcode = barcode.split(",")[0].trim()
      if (!firstBarcode) return []

      const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:oper="http://russianpost.org/operationhistory"
  xmlns:data="http://russianpost.org/operationhistory/data"
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <oper:getOperationHistory>
      <data:OperationHistoryRequest>
        <data:Barcode>${firstBarcode}</data:Barcode>
        <data:MessageType>0</data:MessageType>
        <data:Language>RUS</data:Language>
      </data:OperationHistoryRequest>
      <data:AuthorizationHeader soapenv:mustUnderstand="1">
        <data:login>${config.trackingLogin}</data:login>
        <data:password>${config.trackingPassword}</data:password>
      </data:AuthorizationHeader>
    </oper:getOperationHistory>
  </soap:Body>
</soap:Envelope>`

      try {
        const res = await fetchWithTimeout(TRACKING_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/soap+xml;charset=UTF-8",
          },
          body: soapBody,
        })

        if (!res.ok) return []

        const xml = await res.text()
        const { XMLParser } = await import("fast-xml-parser")
        const parser = new XMLParser({
          ignoreAttributes: false,
          removeNSPrefix: true,
        })
        const parsed = parser.parse(xml)

        const historyRecords =
          parsed?.Envelope?.Body?.getOperationHistoryResponse
            ?.OperationHistoryData?.historyRecord

        if (!historyRecords) return []

        const records = Array.isArray(historyRecords)
          ? historyRecords
          : [historyRecords]

        return records
          .map((r: any) => {
            const operType = r?.OperationParameters?.OperType
            const operAttr = r?.OperationParameters?.OperAttr
            const dateStr = r?.OperationParameters?.DateOper
            const address = r?.AddressParameters?.OperationAddress

            const typeName = operType?.Name || ""
            const attrName = operAttr?.Name || ""
            const name = attrName ? `${typeName}: ${attrName}` : typeName

            return {
              code: `${operType?.Id || 0}.${operAttr?.Id || 0}`,
              name,
              date: dateStr || "",
              cityName: address?.Description || address?.Index || "",
            }
          })
          .reverse()
      } catch (e) {
        console.error("Pochta getTrackingStatus error:", e)
        return []
      }
    },
  }
}
