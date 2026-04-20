"use server"

import { createOrder as createOrderDAL, updateOrderStatus as updateOrderStatusDAL, getOrderById, ALLOWED_TRANSITIONS } from "@/lib/dal/orders"
import { creditBonusesForOrder } from "@/lib/dal/bonuses"
import { updateTasteProfile } from "@/lib/dal/taste-profile"
import type { OrderData } from "@/lib/types"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendOrderStatusEmail, sendOrderConfirmationEmail, sendAdminNewOrderEmail, type OrderEmailData } from "@/lib/email"
import { createPayment, createRefund } from "@/lib/yookassa"
import { headers } from "next/headers"
import { createShipmentForOrder } from "@/lib/delivery/shipment"

async function rollbackOrder(
  orderId: string,
  items: { variantId: string; quantity: number }[],
  bonusUsed: number,
  userId: string | null | undefined
) {
  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "cancelled" },
      })
      for (const item of items) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        })
      }
      if (bonusUsed > 0 && userId) {
        await tx.user.update({
          where: { id: userId },
          data: { bonusBalance: { increment: bonusUsed } },
        })
      }
    })
  } catch (rollbackErr) {
    console.error("Critical: failed to rollback order", orderId, rollbackErr)
  }
}

export async function createOrder(data: OrderData) {
  // Attach userId from session if logged in as customer
  const session = await auth()
  if (session?.user?.id && (session.user as Record<string, unknown>).userType === "customer") {
    data.userId = session.user.id
  }

  // Server-side input validation
  const phoneDigits = data.customerPhone.replace(/\D/g, "")
  if (!/^[78]\d{10}$/.test(phoneDigits)) {
    throw new Error("Некорректный номер телефона")
  }
  if (data.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.customerEmail)) {
    throw new Error("Некорректный email")
  }

  const order = await createOrderDAL(data)
  revalidatePath("/admin/orders")

  // Update user taste profile non-blocking — enriches future recommendations
  if (data.userId) {
    const productIds = data.items.map((i) => i.productId)
    updateTasteProfile(data.userId, productIds, order.total).catch((e) =>
      console.error("Failed to update taste profile:", e)
    )

    // Backfill profile: if user placed an order with phone/email/name and we don't have
    // those in their profile yet, save them — speeds up future checkouts
    try {
      const existing = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { name: true, phone: true, email: true },
      })
      if (existing) {
        const updates: Record<string, string | Date> = {}
        if (!existing.name && data.customerName) updates.name = data.customerName
        if (!existing.phone && data.customerPhone) updates.phone = data.customerPhone
        if (!existing.email && data.customerEmail) {
          updates.email = data.customerEmail.toLowerCase()
          updates.emailVerified = new Date()
        }
        if (Object.keys(updates).length > 0) {
          await prisma.user.update({ where: { id: data.userId }, data: updates })
        }
      }
    } catch (e) {
      console.error("Failed to backfill user profile from order:", e)
    }
  }

  // Build email data with full order details
  const emailData: OrderEmailData = {
    orderNumber: order.orderNumber,
    customerName: data.customerName,
    customerEmail: data.customerEmail,
    customerPhone: data.customerPhone,
    items: data.items.map((i) => ({ name: i.name, weight: i.weight, price: i.price, quantity: i.quantity })),
    subtotal: order.subtotal,
    discount: order.discount,
    deliveryPrice: order.deliveryPrice,
    total: order.total,
    bonusUsed: order.bonusUsed,
    promoCode: data.promoCode,
    deliveryMethod: data.deliveryMethod,
    deliveryType: data.deliveryType,
    deliveryAddress: data.deliveryAddress,
    pickupPointName: data.pickupPointName,
    destinationCity: data.destinationCity,
    estimatedDelivery: data.estimatedDelivery,
    paymentMethod: data.paymentMethod,
    notes: data.notes,
  }

  // Send customer confirmation + admin notification (non-blocking)
  Promise.allSettled([
    sendOrderConfirmationEmail(emailData),
    sendAdminNewOrderEmail(emailData),
  ]).catch((e) => console.error("Failed to send order emails:", e))

  // Online payment via YooKassa
  if (data.paymentMethod === "online") {
    const headersList = await headers()
    const host = headersList.get("host") || "millor-coffee.ru"
    const protocol = headersList.get("x-forwarded-proto") || "https"
    const baseUrl = `${protocol}://${host}`
    const returnUrl = `${baseUrl}/thank-you?order=${order.orderNumber}&token=${order.thankYouToken}`

    let payment
    try {
      payment = await createPayment({
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: order.total,
        returnUrl,
        description: `Заказ ${order.orderNumber} — Millor Coffee`,
      })
    } catch (e) {
      console.error("YooKassa payment creation failed:", e)
      // Rollback: cancel order, restore stock and bonuses
      await rollbackOrder(order.id, data.items, order.bonusUsed, order.userId)
      throw new Error("Ошибка при создании платежа. Попробуйте ещё раз")
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentId: payment.id,
        paymentStatus: "pending",
      },
    })

    const paymentUrl = payment.confirmation?.confirmation_url
    if (!paymentUrl) {
      // YooKassa returned success but no redirect URL — rollback
      await rollbackOrder(order.id, data.items, order.bonusUsed, order.userId)
      throw new Error("Платёжная система не вернула ссылку на оплату. Попробуйте ещё раз")
    }

    return {
      orderNumber: order.orderNumber,
      id: order.id,
      thankYouToken: order.thankYouToken,
      paymentUrl,
    }
  }

  return { orderNumber: order.orderNumber, id: order.id, thankYouToken: order.thankYouToken, paymentUrl: null }
}

export async function updateOrderStatus(id: string, status: string) {
  const session = await auth()
  const userType = (session?.user as Record<string, unknown>)?.userType
  if (!session?.user?.id || userType !== "admin") throw new Error("Нет доступа")

  await updateOrderStatusDAL(id, status)

  // Send email notification + bonus logic
  try {
    const order = await getOrderById(id)
    if (order?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: order.userId },
        select: { email: true, name: true, notifyOrderStatus: true },
      })

      // Send email only for customer-visible statuses
      const customerVisibleStatuses = ["paid", "confirmed", "shipped", "delivered", "cancelled"]
      if (user?.email && user.notifyOrderStatus && customerVisibleStatuses.includes(status)) {
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

      // Auto-create shipment when order is confirmed (COD)
      if (status === "confirmed" && order.paymentMethod !== "online") {
        try {
          await createShipmentForOrder(order.id)
        } catch (e) {
          console.error("Failed to create shipment for order:", order.id, e)
        }
      }
    }
  } catch {
    // Don't fail the status update if email/bonus fails
  }

  revalidatePath("/admin/orders")
  revalidatePath(`/admin/orders/${id}`)
  revalidatePath("/account/orders")
}

export async function updateOrderNotes(orderId: string, adminNotes: string) {
  const session = await auth()
  const userType = (session?.user as Record<string, unknown>)?.userType
  if (!session?.user?.id || userType !== "admin") throw new Error("Нет доступа")

  await prisma.order.update({
    where: { id: orderId },
    data: { adminNotes },
  })
  revalidatePath(`/admin/orders/${orderId}`)
}

const CANCELLABLE_STATUSES = ["pending", "paid", "confirmed"]

export async function cancelOrder(orderId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { select: { variantId: true, quantity: true } } },
  })

  if (!order) throw new Error("Заказ не найден")
  if (order.userId !== session.user.id) throw new Error("Нет доступа")
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    throw new Error("Заказ в этом статусе нельзя отменить")
  }
  if (order.carrierOrderId) {
    throw new Error("Заказ уже передан в службу доставки")
  }

  // Refund via YooKassa if the order was paid online
  if (order.paymentId && order.paymentStatus === "succeeded") {
    try {
      await createRefund(order.paymentId, order.total, order.id)
    } catch (e) {
      console.error("YooKassa refund failed for order:", order.orderNumber, e)
      throw new Error("Не удалось выполнить возврат средств. Свяжитесь с поддержкой")
    }
  }

  await prisma.$transaction(async (tx) => {
    // Update order status
    await tx.order.update({
      where: { id: orderId },
      data: { status: "cancelled", paymentStatus: order.paymentStatus === "succeeded" ? "refunded" : order.paymentStatus },
    })

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "cancelled",
        changedBy: "customer",
      },
    })

    // Return stock
    for (const item of order.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        })
      }
    }

    // Refund bonuses
    if (order.bonusUsed > 0 && order.userId) {
      await tx.user.update({
        where: { id: order.userId },
        data: { bonusBalance: { increment: order.bonusUsed } },
      })
      await tx.bonusTransaction.create({
        data: {
          userId: order.userId,
          amount: order.bonusUsed,
          type: "admin_adjustment",
          description: `Возврат бонусов — отмена заказа ${order.orderNumber}`,
          orderId: order.id,
        },
      })
    }
  })

  revalidatePath("/account/orders")
  revalidatePath(`/account/orders/${orderId}`)
  revalidatePath("/admin/orders")
}

export async function retryPayment(orderId: string): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Не авторизован")

  const order = await prisma.order.findUnique({
    where: { id: orderId },
  })

  if (!order) throw new Error("Заказ не найден")
  if (order.userId !== session.user.id) throw new Error("Нет доступа")
  if (order.paymentMethod !== "online") throw new Error("Заказ не предполагает онлайн-оплату")
  if (order.paymentStatus === "succeeded") throw new Error("Заказ уже оплачен")
  if (order.status === "cancelled") throw new Error("Заказ отменён")

  const headersList = await headers()
  const host = headersList.get("host") || "millor-coffee.ru"
  const protocol = headersList.get("x-forwarded-proto") || "https"
  const baseUrl = `${protocol}://${host}`
  const returnUrl = `${baseUrl}/thank-you?order=${order.orderNumber}${order.thankYouToken ? `&token=${order.thankYouToken}` : ""}`

  // Use unique idempotence key per retry attempt (orderId + timestamp prefix)
  // so that YooKassa creates a new payment after a previous one expired/canceled
  const retryKey = `${order.id}-retry-${Date.now()}`
  const payment = await createPayment({
    orderId: retryKey,
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
  if (!paymentUrl) throw new Error("Платёжная система не вернула ссылку на оплату")

  return paymentUrl
}
