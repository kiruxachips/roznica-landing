import type { Order, OrderItem } from "@prisma/client"
import type { MillorbotCarrier, MillorbotOrderPaidPayload } from "./types"

type OrderWithItems = Order & { items: OrderItem[] }

function normalizeCarrier(method: string | null): MillorbotCarrier | null {
  if (!method) return null
  const m = method.toLowerCase()
  if (m === "cdek" || m === "сдэк") return "cdek"
  if (m === "pochta" || m === "почта" || m === "pochta_russia") return "pochta"
  if (m === "courier" || m === "курьер") return "courier"
  return (method as MillorbotCarrier) || null
}

function siteUrl(): string {
  return (process.env.NEXTAUTH_URL || "https://millor-coffee.ru").replace(/\/$/, "")
}

export function buildOrderPaidPayload(
  order: OrderWithItems,
  opts: { eventId: string; occurredAt?: Date },
): MillorbotOrderPaidPayload {
  const occurredAt = (opts.occurredAt ?? new Date()).toISOString()

  return {
    event_id: opts.eventId,
    event: "order.paid",
    occurred_at: occurredAt,
    order: {
      id: order.id,
      number: order.orderNumber,
      total: order.total,
      subtotal: order.subtotal,
      discount: order.discount,
      deliveryPrice: order.deliveryPrice,
      bonusUsed: order.bonusUsed,
      customer: {
        name: order.customerName,
        email: order.customerEmail,
        phone: order.customerPhone,
      },
      shipping: {
        carrier: normalizeCarrier(order.deliveryMethod),
        type: (order.deliveryType as "pvz" | "door" | null) ?? null,
        city: order.destinationCity ?? undefined,
        cityCode: order.destinationCityCode ? Number(order.destinationCityCode) : undefined,
        postalCode: order.postalCode ?? undefined,
        address: order.deliveryAddress ?? undefined,
        pickupPointCode: order.pickupPointCode ?? undefined,
        pickupPointName: order.pickupPointName ?? undefined,
        carrierOrderId: order.carrierOrderId ?? undefined,
        carrierOrderNum: order.carrierOrderNum ?? undefined,
        trackingNumber: order.trackingNumber ?? undefined,
        estimatedDelivery: order.estimatedDelivery ?? undefined,
        tariffCode: order.tariffCode ?? undefined,
        packageWeight: order.packageWeight ?? undefined,
      },
      items: order.items.map((i) => ({
        name: i.name,
        weight: i.weight,
        price: i.price,
        quantity: i.quantity,
      })),
      notes: order.notes,
      paymentMethod: order.paymentMethod,
      paymentId: order.paymentId,
      adminUrl: `${siteUrl()}/admin/orders/${order.id}`,
    },
  }
}
