export type MillorbotCarrier = "cdek" | "pochta" | "courier" | "yandex" | "DPD" | "boxberry"

export interface MillorbotShipping {
  carrier: MillorbotCarrier | null
  type: "pvz" | "door" | null
  city?: string
  cityCode?: number
  postalCode?: string
  address?: string
  pickupPointCode?: string
  pickupPointName?: string
  carrierOrderId?: string
  carrierOrderNum?: string
  trackingNumber?: string
  estimatedDelivery?: string
  tariffCode?: number
  packageWeight?: number
}

export interface MillorbotOrderItem {
  name: string
  weight: string
  price: number
  quantity: number
}

export interface MillorbotOrder {
  id: string
  number: string
  total: number
  subtotal: number
  discount: number
  deliveryPrice: number
  bonusUsed: number
  customer: {
    name: string
    email: string | null
    phone: string
  }
  shipping: MillorbotShipping
  items: MillorbotOrderItem[]
  notes: string | null
  paymentMethod: string | null
  paymentId: string | null
  adminUrl: string
}

export interface MillorbotOrderPaidPayload {
  event_id: string
  event: "order.paid"
  occurred_at: string
  order: MillorbotOrder
}

export interface MillorbotStockPayload {
  event_id: string
  event: "product.stock.depleted" | "product.stock.low"
  occurred_at: string
  product: {
    id: string
    name: string
    slug: string
    adminUrl: string
  }
  variant: {
    id: string
    weight: string
    sku: string | null
  }
  stock: {
    before: number
    after: number
    threshold: number | null
  }
}

// ── Wholesale (B2B) events ──

export interface MillorbotWholesaleAccessRequestPayload {
  event_id: string
  event: "wholesale.access_request.created" | "wholesale.access_request.approved"
  occurred_at: string
  request: {
    id: string
    legalName: string
    inn: string
    contactName?: string
    contactPhone?: string
    contactEmail?: string
    expectedVolume?: string | null
    comment?: string | null
    companyId?: string
    admin_url: string
  }
}

export interface MillorbotWholesaleOrderPayload {
  event_id: string
  event:
    | "wholesale.order.created"
    | "wholesale.order.approved"
    | "wholesale.order.cancelled"
    | "wholesale.order.status_changed"
  occurred_at: string
  order: {
    id: string
    number: string
    total: number
    subtotal?: number
    paymentTerms: string | null
    approvalStatus: string | null
    itemsCount?: number
    admin_url: string
  }
  company: {
    id: string
    legalName: string | null
    inn: string | null
  }
  user?: {
    id: string
    name: string
    email: string
  }
}

export type MillorbotOutboxPayload =
  | MillorbotOrderPaidPayload
  | MillorbotStockPayload
  | MillorbotWholesaleAccessRequestPayload
  | MillorbotWholesaleOrderPayload

// Inbound from bot
export type NormalizedTrackingStatus =
  | "pending"
  | "shipped"
  | "in_transit"
  | "arrived"
  | "delivered"
  | "returned"
  | "exception"

export interface MillorbotTrackingPayload {
  event_id: string
  occurred_at: string
  orderNumber: string
  carrier: MillorbotCarrier | string
  trackingNumber?: string
  status: {
    code: string
    text: string
    normalized: NormalizedTrackingStatus
  }
  carrierOrderId?: string
}
