"use server"

import { createOrder as createOrderDAL, updateOrderStatus as updateOrderStatusDAL, getOrderById } from "@/lib/dal/orders"
import { creditBonusesForOrder } from "@/lib/dal/bonuses"
import type { OrderData } from "@/lib/types"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendOrderStatusEmail } from "@/lib/email"
import { createPayment } from "@/lib/yookassa"
import { headers } from "next/headers"

export async function createOrder(data: OrderData) {
  // Attach userId from session if logged in as customer
  const session = await auth()
  if (session?.user?.id && (session.user as Record<string, unknown>).userType === "customer") {
    data.userId = session.user.id
  }

  const order = await createOrderDAL(data)
  revalidatePath("/admin/orders")

  // Online payment via YooKassa
  if (data.paymentMethod === "online") {
    try {
      const headersList = await headers()
      const host = headersList.get("host") || "millor-coffee.ru"
      const protocol = headersList.get("x-forwarded-proto") || "https"
      const baseUrl = `${protocol}://${host}`
      const returnUrl = `${baseUrl}/thank-you?order=${order.orderNumber}&token=${order.thankYouToken}`

      const payment = await createPayment({
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: order.total,
        returnUrl,
        description: `Заказ ${order.orderNumber} — Millor Coffee`,
      })

      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentId: payment.id,
          paymentStatus: "pending",
        },
      })

      const paymentUrl = payment.confirmation?.confirmation_url
      return {
        orderNumber: order.orderNumber,
        id: order.id,
        thankYouToken: order.thankYouToken,
        paymentUrl: paymentUrl || null,
      }
    } catch (e) {
      console.error("YooKassa payment creation failed:", e)
      // Order is created but payment failed — return without paymentUrl
      // User can retry or pay on delivery
    }
  }

  return { orderNumber: order.orderNumber, id: order.id, thankYouToken: order.thankYouToken, paymentUrl: null }
}

export async function updateOrderStatus(id: string, status: string) {
  await updateOrderStatusDAL(id, status)

  // Send email notification + bonus logic
  try {
    const order = await getOrderById(id)
    if (order?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: order.userId },
        select: { email: true, name: true, notifyOrderStatus: true },
      })

      // Send email if user opted in
      if (user?.email && user.notifyOrderStatus) {
        await sendOrderStatusEmail({
          to: user.email,
          customerName: user.name || "Клиент",
          orderNumber: order.orderNumber,
          newStatus: status,
        })
      }

      // Credit bonuses on delivery
      if (status === "delivered") {
        await creditBonusesForOrder(order.userId, order.id, order.total)
      }
    }
  } catch {
    // Don't fail the status update if email/bonus fails
  }

  revalidatePath("/admin/orders")
  revalidatePath(`/admin/orders/${id}`)
  revalidatePath("/account/orders")
}
