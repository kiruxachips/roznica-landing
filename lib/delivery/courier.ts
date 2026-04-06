import type {
  DeliveryProvider,
  DeliveryRateRequest,
  DeliveryRate,
  PickupPoint,
  CreateShipmentResult,
  TrackingStatus,
} from "./types"

export function createCourierProvider(config: {
  price: number
  regionPrice: number
  city: string
  freeThreshold: number
}): DeliveryProvider {
  return {
    carrier: "courier",

    async calculateRates(req: DeliveryRateRequest): Promise<DeliveryRate[]> {
      const toCity = req.toCity?.toLowerCase() || ""
      const toRegion = req.toRegion?.toLowerCase() || ""
      const isKaliningradRegion = toRegion.includes("калининград")

      // Only show courier for Kaliningrad region
      if (!isKaliningradRegion) return []

      const isCity = toCity === config.city.toLowerCase()
      const basePrice = isCity ? config.price : config.regionPrice
      const price = (req.cartTotal || 0) >= config.freeThreshold ? 0 : basePrice

      return [
        {
          carrier: "courier",
          carrierName: "Наш курьер",
          tariffCode: 0,
          tariffName: isCity
            ? `Наш курьер — ${config.city}`
            : `Наш курьер — Калининградская обл.`,
          deliveryType: "door",
          price,
          priceWithMarkup: price,
          minDays: 1,
          maxDays: isCity ? 2 : 3,
        },
      ]
    },

    async getPickupPoints(): Promise<PickupPoint[]> {
      return []
    },

    async createShipment(): Promise<CreateShipmentResult> {
      // Local courier — no carrier integration
      return { carrierOrderId: "local" }
    },

    async getTrackingStatus(): Promise<TrackingStatus[]> {
      return []
    },
  }
}
