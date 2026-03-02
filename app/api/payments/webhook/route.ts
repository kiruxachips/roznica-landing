import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendOrderStatusEmail } from "@/lib/email"

// YooKassa IP ranges (validate only in production)
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
  // IP validation in production
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
      metadata?: { orderId?: string; orderNumber?: string }
    }
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { event, object } = body
  const paymentId = object?.id

  if (!paymentId) {
    return NextResponse.json({}, { status: 200 })
  }

  const order = await prisma.order.findFirst({
    where: { paymentId },
    include: { user: { select: { email: true, name: true, notifyOrderStatus: true } } },
  })

  if (!order) {
    console.warn(`Webhook: order not found for paymentId ${paymentId}`)
    return NextResponse.json({}, { status: 200 })
  }

  if (event === "payment.succeeded") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "paid",
        paymentStatus: "succeeded",
      },
    })

    // Send email notification
    if (order.user?.email && order.user.notifyOrderStatus) {
      try {
        await sendOrderStatusEmail({
          to: order.user.email,
          customerName: order.user.name || "Клиент",
          orderNumber: order.orderNumber,
          newStatus: "paid",
        })
      } catch (e) {
        console.error("Failed to send payment email:", e)
      }
    }
  } else if (event === "payment.canceled") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "cancelled",
        paymentStatus: "canceled",
      },
    })

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
