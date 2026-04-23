import type { Package } from "./packaging"

export type { Package } from "./packaging"

export interface DeliveryRateRequest {
  fromCityCode?: string
  fromPostalCode?: string
  toCityCode?: string
  toPostalCode?: string
  toCity?: string
  toRegion?: string
  /** Физический план упаковки — массив коробок. Не пустой. */
  packages: Package[]
  cartTotal?: number // rubles, for markup filtering
}

export interface DeliveryRate {
  carrier: "cdek" | "pochta" | "courier"
  carrierName: string
  tariffCode: number
  tariffName: string
  deliveryType: "door" | "pvz"
  price: number // original price in rubles
  priceWithMarkup: number // price after markup rules
  minDays: number
  maxDays: number
}

export interface PickupPoint {
  code: string
  name: string
  address: string
  lat: number
  lng: number
  phone?: string
  workTime?: string
  carrier: "cdek" | "pochta"
}

export interface CreateShipmentRequest {
  orderId: string
  carrier: "cdek" | "pochta"
  tariffCode: number
  deliveryType: "door" | "pvz"
  pickupPointCode?: string
  senderCityCode: string
  senderPostalCode?: string
  recipientCityCode?: string
  recipientPostalCode?: string
  recipientName: string
  recipientPhone: string
  recipientAddress?: string
  items: {
    name: string
    weight: number // grams per unit
    price: number // rubles
    quantity: number
  }[]
  /** Физический план упаковки — массив коробок. Не пустой. */
  packages: Package[]
}

export interface CreateShipmentResult {
  carrierOrderId: string
  carrierOrderNum?: string
  trackingNumber?: string
}

export interface TrackingStatus {
  code: string
  name: string
  date: string
  cityName?: string
}

export interface CitySearchResult {
  code: string
  city: string
  region: string
  postalCodes?: string[]
}

export interface PickupPointsOptions {
  /** Для Pochta — помогает отличить Гурьевск Калининградский от Кемеровского. */
  region?: string
  /** Первые 3 цифры индекса определяют регион Почты России (238xxx = Калининград). */
  postalCode?: string
}

export interface DeliveryProvider {
  carrier: "cdek" | "pochta" | "courier"
  calculateRates(req: DeliveryRateRequest): Promise<DeliveryRate[]>
  /** CDEK: pass city code. Pochta: pass city name + optional region/postalCode. */
  getPickupPoints(
    cityOrCode: string,
    options?: PickupPointsOptions
  ): Promise<PickupPoint[]>
  createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult>
  getTrackingStatus(carrierOrderId: string): Promise<TrackingStatus[]>
}
