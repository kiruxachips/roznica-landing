import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifySignature } from "@/lib/integrations/hmac"
import { logIntegration } from "@/lib/dal/integration-log"
import {
  renderOrderShippedEmail,
  renderOrderDeliveredEmail,
  sendRenderedEmail,
  type ShippedEmailData,
  type OrderEmailData,
} from "@/lib/email"
import { dispatchEmail } from "@/lib/dal/email-dispatch"
import { ALLOWED_TRANSITIONS } from "@/lib/dal/orders"
import type { MillorbotTrackingPayload, NormalizedTrackingStatus } from "@/lib/integrations/millorbot/types"

export const runtime = "nodejs"

const SOURCE = "millorbot"
const EVENT = "tracking.updated"

function mapToOrderStatus(normalized: NormalizedTrackingStatus): string | null {
  if (normalized === "delivered") return "delivered"
  if (normalized === "shipped" || normalized === "in_transit" || normalized === "arrived") return "shipped"
  return null
}

function canTransition(from: string, to: string): boolean {
  if (from === to) return false
  return (ALLOWED_TRANSITIONS[from] || []).includes(to)
}

function buildEmailData(order: {
  orderNumber: string
  customerName: string
  customerEmail: string | null
  customerPhone: string
  items: { name: string; weight: string; price: number; quantity: number }[]
  subtotal: number
  discount: number
  deliveryPrice: number
  total: number
  bonusUsed: number
  promoCode?: { code: string } | null
  deliveryMethod: string | null
  deliveryType: string | null
  deliveryAddress: string | null
  pickupPointName: string | null
  destinationCity: string | null
  estimatedDelivery: string | null
  paymentMethod: string | null
  notes: string | null
  trackingToken: string | null
}): OrderEmailData {
  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail || undefined,
    customerPhone: order.customerPhone,
    items: order.items,
    subtotal: order.subtotal,
    discount: order.discount,
    deliveryPrice: order.deliveryPrice,
    total: order.total,
    bonusUsed: order.bonusUsed,
    promoCode: order.promoCode?.code,
    deliveryMethod: order.deliveryMethod || undefined,
    deliveryType: order.deliveryType || undefined,
    deliveryAddress: order.deliveryAddress || undefined,
    pickupPointName: order.pickupPointName || undefined,
    destinationCity: order.destinationCity || undefined,
    estimatedDelivery: order.estimatedDelivery || undefined,
    paymentMethod: order.paymentMethod || undefined,
    notes: order.notes || undefined,
    trackingToken: order.trackingToken ?? undefined,
  }
}

export async function POST(request: NextRequest) {
  const started = Date.now()
  const secret = process.env.MILLORBOT_SHARED_SECRET

  if (!secret) {
    console.error("MILLORBOT_SHARED_SECRET not configured — rejecting webhook")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  // Must read raw text for HMAC verification
  const rawBody = await request.text()

  const verify = verifySignature(
    rawBody,
    request.headers.get("X-Millorbot-Timestamp"),
    request.headers.get("X-Millorbot-Signature"),
    secret,
  )

  if (!verify.ok) {
    await logIntegration({
      direction: "inbound",
      source: SOURCE,
      event: EVENT,
      statusCode: 401,
      error: `auth_${verify.reason}`,
      durationMs: Date.now() - started,
    })
    return NextResponse.json({ error: "Unauthorized", reason: verify.reason }, { status: 401 })
  }

  let payload: MillorbotTrackingPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!payload?.event_id || !payload.orderNumber || !payload.status?.normalized) {
    await logIntegration({
      direction: "inbound",
      source: SOURCE,
      event: EVENT,
      statusCode: 400,
      error: "missing_required_fields",
      request: payload as never,
      durationMs: Date.now() - started,
    })
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Idempotency: short-circuit if we've already processed this event_id
  const already = await prisma.processedInboundEvent.findUnique({
    where: { source_eventId: { source: SOURCE, eventId: payload.event_id } },
  })
  if (already) {
    return NextResponse.json({ ok: true, idempotent: true })
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: payload.orderNumber },
    include: {
      items: { select: { name: true, weight: true, price: true, quantity: true } },
      promoCode: { select: { code: true } },
    },
  })

  if (!order) {
    await logIntegration({
      direction: "inbound",
      source: SOURCE,
      event: EVENT,
      eventId: payload.event_id,
      statusCode: 404,
      error: "order_not_found",
      request: payload as never,
      durationMs: Date.now() - started,
    })
    return NextResponse.json({ error: "Order not found" }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}

  if (payload.trackingNumber && payload.trackingNumber !== order.trackingNumber) {
    updates.trackingNumber = payload.trackingNumber
    if (!order.carrierOrderNum) updates.carrierOrderNum = payload.trackingNumber
  }

  if (payload.carrierOrderId && payload.carrierOrderId !== order.carrierOrderId) {
    updates.carrierOrderId = payload.carrierOrderId
  }

  const newCarrierStatus = payload.status.text || payload.status.code
  if (newCarrierStatus && newCarrierStatus !== order.carrierStatus) {
    updates.carrierStatus = newCarrierStatus
  }

  const mappedStatus = mapToOrderStatus(payload.status.normalized)
  let statusChanged: { from: string; to: string } | null = null
  if (mappedStatus && canTransition(order.status, mappedStatus)) {
    updates.status = mappedStatus
    statusChanged = { from: order.status, to: mappedStatus }
  }

  if (Object.keys(updates).length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: updates })
      if (statusChanged) {
        await tx.orderStatusLog.create({
          data: {
            orderId: order.id,
            fromStatus: statusChanged.from,
            toStatus: statusChanged.to,
            changedBy: "millorbot",
          },
        })
      }
      await tx.processedInboundEvent.create({
        data: { source: SOURCE, eventId: payload.event_id },
      })
    })
  } else {
    // No changes but still record the event for idempotency
    await prisma.processedInboundEvent.create({
      data: { source: SOURCE, eventId: payload.event_id },
    })
  }

  // Fire customer emails on status transitions — после flush'а ответа millorbot'у.
  // dispatchEmail кладёт в EmailDispatch, второй webhook с тем же переходом не отправит
  // письмо повторно (хотя processedInboundEvent уже защищает от повторной обработки,
  // это второй слой idempotency).
  if (statusChanged && order.customerEmail) {
    const user = order.userId
      ? await prisma.user.findUnique({
          where: { id: order.userId },
          select: { notifyOrderStatus: true },
        })
      : null
    const shouldNotify = user ? user.notifyOrderStatus : true

    if (shouldNotify) {
      const recipient = order.customerEmail
      const orderIdForEmail = order.id
      const emailData = buildEmailData(order)
      if (statusChanged.to === "shipped") {
        const shippedData: ShippedEmailData = {
          ...emailData,
          trackingNumber: (updates.trackingNumber as string) || order.trackingNumber || undefined,
        }
        after(async () => {
          await dispatchEmail({
            orderId: orderIdForEmail,
            kind: "order.shipped",
            recipient,
            render: () => renderOrderShippedEmail(shippedData),
            send: sendRenderedEmail,
          })
        })
      } else if (statusChanged.to === "delivered") {
        after(async () => {
          await dispatchEmail({
            orderId: orderIdForEmail,
            kind: "order.delivered",
            recipient,
            render: () => renderOrderDeliveredEmail(emailData),
            send: sendRenderedEmail,
          })
        })
      }
    }
  }

  await logIntegration({
    direction: "inbound",
    source: SOURCE,
    event: EVENT,
    eventId: payload.event_id,
    statusCode: 200,
    request: payload as never,
    response: { applied: Object.keys(updates), statusChanged },
    durationMs: Date.now() - started,
  })

  return NextResponse.json({ ok: true, applied: Object.keys(updates) })
}
