export interface DeliveryRateRequest {
  fromCityCode?: string
  fromPostalCode?: string
  toCityCode?: string
  toPostalCode?: string
  toCity?: string
  weight: number // grams
  length?: number // cm
  width?: number // cm
  height?: number // cm
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
  recipientCityCode?: string
  recipientPostalCode?: string
  recipientName: string
  recipientPhone: string
  recipientAddress?: string
  items: {
    name: string
    weight: number // grams
    price: number // rubles
    quantity: number
  }[]
  weight: number // total grams
  length: number
  width: number
  height: number
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

export interface DeliveryProvider {
  carrier: "cdek" | "pochta" | "courier"
  calculateRates(req: DeliveryRateRequest): Promise<DeliveryRate[]>
  getPickupPoints(cityCode: string): Promise<PickupPoint[]>
  createShipment(req: CreateShipmentRequest): Promise<CreateShipmentResult>
  getTrackingStatus(carrierOrderId: string): Promise<TrackingStatus[]>
}
