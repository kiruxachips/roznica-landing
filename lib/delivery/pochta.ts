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

export function createPochtaProvider(config: {
  accessToken?: string
  userAuth?: string
  objectType: number // 47030 = посылка нестандартная
  senderPostalCode: string
}): DeliveryProvider {
  return {
    carrier: "pochta",

    async calculateRates(req: DeliveryRateRequest): Promise<DeliveryRate[]> {
      if (!req.toPostalCode) return []

      const params = new URLSearchParams({
        "object": config.objectType.toString(),
        "from": config.senderPostalCode,
        "to": req.toPostalCode,
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
          fetch(`${TARIFF_API}?${params}`),
          fetch(`${DELIVERY_API}?${new URLSearchParams({
            "object": config.objectType.toString(),
            "from": config.senderPostalCode,
            "to": req.toPostalCode,
          })}`),
        ])

        let price = 0
        if (tariffRes.status === "fulfilled" && tariffRes.value.ok) {
          const data = await tariffRes.value.json()
          // Pochta returns price in kopecks
          price = Math.ceil((data.ground?.val || data.paynds || 0) / 100)
        } else {
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
            tariffName: "Почта России — Посылка",
            deliveryType: "door",
            price,
            priceWithMarkup: price,
            minDays,
            maxDays,
          },
        ]
      } catch {
        return []
      }
    },

    async getPickupPoints(): Promise<PickupPoint[]> {
      // Pochta delivers to address/postal index, no PVZ selection
      return []
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
          "index-to": parseInt(req.recipientPostalCode || "0"),
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

      const res = await fetch(`${OTPRAVKA_API}/1.0/user/backlog`, {
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

    async getTrackingStatus(): Promise<TrackingStatus[]> {
      // MVP: manual tracking in admin
      return []
    },
  }
}
