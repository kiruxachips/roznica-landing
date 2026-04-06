import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendOrderStatusEmail, sendPaymentSuccessEmail, sendAdminPaymentSuccessEmail, type OrderEmailData } from "@/lib/email"
import { createShipmentForOrder } from "@/lib/delivery/shipment"
import { getPayment } from "@/lib/yookassa"

// YooKassa IP ranges (first line of defense)
const YOOKASSA_IPS = [
  "185.71.76.",
  "185.71.77.",
  "77.75.153.",
  "77.75.154.",
  "77.75.156.",
]

function isYookassaIp(ip: string): boolean {
  return YOOKASSA_IPS.some((prefix) => ip.startsWith(prefix))
}

export async function POST(request: NextRequest) {
  // IP validation in production (first line of defense)
  if (process.env.NODE_ENV === "production") {
    const forwarded = request.headers.get("x-forwarded-for")
    const ip = forwarded?.split(",")[0]?.trim() || ""
    if (!isYookassaIp(ip)) {
      console.warn(`Webhook rejected: untrusted IP ${ip}`)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  let body: {
    type: string
    event: string
    object: {
      id: string
      status: string
    }
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const paymentId = body.object?.id

  if (!paymentId) {
    return NextResponse.json({}, { status: 200 })
  }

  // Second line of defense: verify payment via direct API call.
  // We never trust webhook body data — always fetch the real status from YooKassa.
  let verifiedPayment
  try {
    verifiedPayment = await getPayment(paymentId)
  } catch (e) {
    console.error(`Webhook: failed to verify payment ${paymentId}:`, e)
    // Return 500 so YooKassa retries the webhook later
    return NextResponse.json({ error: "Payment verification failed" }, { status: 500 })
  }

  const order = await prisma.order.findFirst({
    where: { paymentId },
    include: {
      user: { select: { email: true, name: true, notifyOrderStatus: true } },
      items: { select: { variantId: true, quantity: true, name: true, weight: true, price: true } },
      promoCode: { select: { code: true } },
    },
  })

  if (!order) {
    console.warn(`Webhook: order not found for paymentId ${paymentId}`)
    return NextResponse.json({}, { status: 200 })
  }

  // Use verified status from API, not from webhook body
  const verifiedStatus = verifiedPayment.status

  if (verifiedStatus === "succeeded") {
    // Idempotency: skip if already processed
    if (order.paymentStatus === "succeeded") {
      return NextResponse.json({}, { status: 200 })
    }

    // Validate payment amount from verified API response
    const paidAmount = parseFloat(verifiedPayment.amount.value)
    if (Math.abs(paidAmount - order.total) > 1) {
      console.error("Payment amount mismatch", {
        paymentId,
        paidAmount,
        orderTotal: order.total,
        orderId: order.id,
      })
      return NextResponse.json({ error: "Amount mismatch" }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { status: "paid", paymentStatus: "succeeded" },
      }),
      prisma.orderStatusLog.create({
        data: { orderId: order.id, fromStatus: order.status, toStatus: "paid", changedBy: "system" },
      }),
    ])

    // Build email data for detailed payment notifications
    const emailData: OrderEmailData = {
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail || undefined,
      customerPhone: order.customerPhone,
      items: order.items.map((i) => ({ name: i.name, weight: i.weight, price: i.price, quantity: i.quantity })),
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
    }

    // Send payment success emails (customer + admin, non-blocking)
    Promise.allSettled([
      emailData.customerEmail ? sendPaymentSuccessEmail(emailData) : Promise.resolve(),
      sendAdminPaymentSuccessEmail(emailData),
    ]).catch((e) => console.error("Failed to send payment emails:", e))

    // Auto-create shipment with carrier
    try {
      await createShipmentForOrder(order.id)
    } catch (e) {
      console.error("Failed to create shipment for order:", order.id, e)
    }
  } else if (verifiedStatus === "canceled") {
    // Idempotency: skip if already cancelled
    if (order.paymentStatus === "canceled" || order.status === "cancelled") {
      return NextResponse.json({}, { status: 200 })
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: { status: "cancelled", paymentStatus: "canceled" },
      }),
      prisma.orderStatusLog.create({
        data: { orderId: order.id, fromStatus: order.status, toStatus: "cancelled", changedBy: "system" },
      }),
    ])

    // Return stock for cancelled payment
    for (const item of order.items) {
      if (item.variantId) {
        await prisma.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        })
      }
    }

    // Refund bonuses if used
    if (order.bonusUsed > 0 && order.userId) {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: order.userId },
          data: { bonusBalance: { increment: order.bonusUsed } },
        }),
        prisma.bonusTransaction.create({
          data: {
            userId: order.userId,
            amount: order.bonusUsed,
            type: "admin_adjustment",
            description: `Возврат бонусов — отмена оплаты заказа ${order.orderNumber}`,
            orderId: order.id,
          },
        }),
      ])
    }

    // Send email notification
    if (order.user?.email && order.user.notifyOrderStatus) {
      try {
        await sendOrderStatusEmail({
          to: order.user.email,
          customerName: order.user.name || "Клиент",
          orderNumber: order.orderNumber,
          newStatus: "payment_failed",
        })
      } catch (e) {
        console.error("Failed to send payment failure email:", e)
      }
    }
  }

  // Always return 200 so YooKassa doesn't retry
  return NextResponse.json({}, { status: 200 })
}
