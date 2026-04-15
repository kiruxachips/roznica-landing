import { fetchWithTimeout } from "./utils"
import type {
  DeliveryProvider,
  DeliveryRateRequest,
  DeliveryRate,
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

export function createPochtaProvider(config: {
  accessToken?: string
  userAuth?: string
  trackingLogin?: string
  trackingPassword?: string
  objectType: number // 47030 = посылка нестандартная
  senderPostalCode: string
}): DeliveryProvider {
  return {
    carrier: "pochta",

    async calculateRates(req: DeliveryRateRequest): Promise<DeliveryRate[]> {
      let postalCode = req.toPostalCode

      // If no postal code provided, try to look up from city name
      if (!postalCode && req.toCity) {
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
          // Lookup failed — can't calculate without postal code
        }
      }

      if (!postalCode) return []

      const params = new URLSearchParams({
        "object": config.objectType.toString(),
        "from": config.senderPostalCode,
        "to": postalCode,
        "weight": req.weight.toString(),
        "group": "0",
        "closed": "1",
        "date": new Date().toISOString().slice(0, 8) + "01",
      })

      if (req.length && req.width && req.height) {
        const dimension = Math.max(req.length, req.width, req.height)
        params.set("dimension", `${req.length}x${req.width}x${req.height}`)
        params.set("dimensiontype", dimension > 60 ? "0" : "1")
      }

      try {
        const [tariffRes, deliveryRes] = await Promise.allSettled([
          fetchWithTimeout(`${TARIFF_API}?${params}`),
          fetchWithTimeout(`${DELIVERY_API}?${new URLSearchParams({
            "object": config.objectType.toString(),
            "from": config.senderPostalCode,
            "to": postalCode,
          })}`),
        ])

        let price = 0
        if (tariffRes.status === "fulfilled" && tariffRes.value.ok) {
          const data = await tariffRes.value.json()
          // Pochta returns price in kopecks
          price = Math.ceil((data.ground?.val || data.paynds || 0) / 100)
        } else {
          const reason = tariffRes.status === "rejected" ? tariffRes.reason : `HTTP ${tariffRes.value.status}`
          console.error("Pochta tariff API failed:", reason)
          return []
        }

        let minDays = 5
        let maxDays = 14
        if (deliveryRes.status === "fulfilled" && deliveryRes.value.ok) {
          const data = await deliveryRes.value.json()
          minDays = data.delivery?.min || 5
          maxDays = data.delivery?.max || 14
        }

        return [
          {
            carrier: "pochta",
            carrierName: "Почта России",
            tariffCode: config.objectType,
            tariffName: "Почта России — До двери",
            deliveryType: "door",
            price,
            priceWithMarkup: price,
            minDays,
            maxDays,
          },
          {
            carrier: "pochta",
            carrierName: "Почта России",
            tariffCode: config.objectType + POCHTA_PVZ_TARIFF_OFFSET,
            tariffName: "Почта России — До отделения",
            deliveryType: "pvz",
            price,
            priceWithMarkup: price,
            minDays: Math.max(minDays - 1, 1),
            maxDays: Math.max(maxDays - 1, minDays),
          },
        ]
      } catch (e) {
        console.error("Pochta calculateRates error:", e)
        return []
      }
    },

    async getPickupPoints(cityName: string): Promise<PickupPoint[]> {
      if (!config.accessToken || !config.userAuth || !cityName) return []

      try {
        const res = await fetchWithTimeout(
          `${OTPRAVKA_API}/1.0/postoffice/1.0/by-address?${new URLSearchParams({ address: cityName })}`,
          {
            headers: {
              Authorization: `AccessToken ${config.accessToken}`,
              "X-User-Authorization": `Basic ${config.userAuth}`,
              Accept: "application/json;charset=UTF-8",
            },
          }
        )

        if (!res.ok) return []

        const data = await res.json()
        const offices: unknown[] = Array.isArray(data) ? data : []

        return offices
          .filter((o: any) => o.latitude && o.longitude)
          .map((o: any) => ({
            code: String(o["postal-code"] || o.postalCode || ""),
            name: `Почтовое отделение ${o["postal-code"] || o.postalCode || ""}`,
            address: o["address-source"] || o.addressSource || "",
            lat: o.latitude,
            lng: o.longitude,
            workTime: o["work-time"] || o.workTime || undefined,
            phone: o["phone-list"]?.[0] || o.phoneList?.[0] || undefined,
            carrier: "pochta" as const,
          }))
      } catch (e) {
        console.error("Pochta getPickupPoints error:", e)
        return []
      }
    },

    async createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult> {
      if (!config.accessToken || !config.userAuth) {
        throw new Error("Pochta RF API tokens not configured")
      }

      const body = [
        {
          "address-type-to": "DEFAULT",
          "given-name": req.recipientName.split(" ")[0] || req.recipientName,
          "house-to": "",
          "index-to": req.deliveryType === "pvz" && req.pickupPointCode
            ? parseInt(req.pickupPointCode)
            : parseInt(req.recipientPostalCode || "0"),
          "mail-category": "ORDINARY",
          "mail-direct": 643,
          "mail-type": "POSTAL_PARCEL",
          "mass": req.weight,
          "order-num": req.orderId,
          "place-to": req.recipientAddress || "",
          "postoffice-code": config.senderPostalCode,
          "recipient-name": req.recipientName,
          "str-index-to": req.recipientPostalCode || "",
          "tel-address": parseInt(req.recipientPhone.replace(/\D/g, "")),
          "dimension": {
            "height": req.height * 10, // mm
            "length": req.length * 10,
            "width": req.width * 10,
          },
        },
      ]

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
      const result = data.result_ids?.[0]

      return {
        carrierOrderId: result?.toString() || "",
        trackingNumber: data.barcode?.[0] || undefined,
      }
    },

    async getTrackingStatus(barcode: string): Promise<TrackingStatus[]> {
      if (!config.trackingLogin || !config.trackingPassword || !barcode) return []

      const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:oper="http://russianpost.org/operationhistory"
  xmlns:data="http://russianpost.org/operationhistory/data"
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <oper:getOperationHistory>
      <data:OperationHistoryRequest>
        <data:Barcode>${barcode}</data:Barcode>
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
