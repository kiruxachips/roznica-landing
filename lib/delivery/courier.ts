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
  city: string
  freeThreshold: number
}): DeliveryProvider {
  return {
    carrier: "courier",

    async calculateRates(req: DeliveryRateRequest): Promise<DeliveryRate[]> {
      const price = (req.cartTotal || 0) >= config.freeThreshold ? 0 : config.price
      return [
        {
          carrier: "courier",
          carrierName: `Курьер (${config.city})`,
          tariffCode: 0,
          tariffName: `Курьерская доставка — ${config.city}`,
          deliveryType: "door",
          price,
          priceWithMarkup: price,
          minDays: 1,
          maxDays: 2,
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
