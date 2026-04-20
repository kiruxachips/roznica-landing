"use server"

import { createOrder as createOrderDAL, updateOrderStatus as updateOrderStatusDAL, getOrderById, ALLOWED_TRANSITIONS } from "@/lib/dal/orders"
import { creditBonusesForOrder } from "@/lib/dal/bonuses"
import { updateTasteProfile } from "@/lib/dal/taste-profile"
import type { OrderData } from "@/lib/types"
import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  renderOrderConfirmationEmail,
  renderAdminNewOrderEmail,
  renderOrderStatusEmail,
  sendRenderedEmail,
  getAdminNotificationEmails,
  type OrderEmailData,
} from "@/lib/email"
import { dispatchEmail } from "@/lib/dal/email-dispatch"
import { createPayment, createRefund } from "@/lib/yookassa"
import { headers } from "next/headers"
import { createShipmentForOrder } from "@/lib/delivery/shipment"
import { adjustStock, type StockAdjustResult } from "@/lib/dal/stock"
import { notifyStockChanges } from "@/lib/integrations/stock-alerts"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"

async function rollbackOrder(
  orderId: string,
  items: { variantId: string; quantity: number; name?: string }[],
  bonusUsed: number,
  userId: string | null | undefined
) {
  const stockResults: StockAdjustResult[] = []
  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "cancelled" },
      })
      for (const item of items) {
        const res = await adjustStock(
          {
            variantId: item.variantId,
            delta: +item.quantity,
            reason: "order_cancelled",
            orderId,
            notes: "Откат при ошибке создания платежа",
            changedBy: "system",
          },
          tx
        )
        stockResults.push(res)
      }
      if (bonusUsed > 0 && userId) {
        await tx.user.update({
          where: { id: userId },
          data: { bonusBalance: { increment: bonusUsed } },
        })
      }
    })
    if (stockResults.length > 0) {
      void notifyStockChanges(stockResults)
    }
  } catch (rollbackErr) {
    console.error("Critical: failed to rollback order", orderId, rollbackErr)
  }
}

export type CreateOrderResult =
  | { success: true; orderNumber: string; id: string; thankYouToken: string | null; paymentUrl: string | null }
  | { success: false; error: string }

export async function createOrder(data: OrderData): Promise<CreateOrderResult> {
  try {
    return await createOrderImpl(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Неизвестная ошибка при создании заказа"
    console.error("[createOrder] failed:", {
      customer: data.customerName,
      phone: data.customerPhone,
      method: data.deliveryMethod,
      tariff: data.tariffCode,
      items: data.items.length,
      error: msg,
      stack: e instanceof Error ? e.stack : undefined,
    })
    return { success: false, error: msg }
  }
}

async function createOrderImpl(data: OrderData): Promise<CreateOrderResult> {
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

  // Send customer confirmation + admin notification after the response is flushed.
  // dispatchEmail сохраняет EmailDispatch со status="pending" + snapshot(subject,html)
  // ДО отправки. Если процесс упадёт посередине — воркер подхватит и отправит.
  // При успехе status → "sent"; при SMTP-ошибке → "failed" с retry-backoff.
  const orderIdForEmail = order.id
  const adminEmails = getAdminNotificationEmails()
  after(async () => {
    const tasks: Promise<void>[] = []
    if (emailData.customerEmail) {
      tasks.push(
        dispatchEmail({
          orderId: orderIdForEmail,
          kind: "order.confirmation",
          recipient: emailData.customerEmail,
          render: () => renderOrderConfirmationEmail(emailData),
          send: sendRenderedEmail,
        })
      )
    }
    for (const admin of adminEmails) {
      tasks.push(
        dispatchEmail({
          orderId: orderIdForEmail,
          kind: "admin.new_order",
          recipient: admin,
          render: () => renderAdminNewOrderEmail(emailData),
          send: sendRenderedEmail,
        })
      )
    }
    await Promise.allSettled(tasks)
  })

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
      success: true,
      orderNumber: order.orderNumber,
      id: order.id,
      thankYouToken: order.thankYouToken,
      paymentUrl,
    }
  }

  return {
    success: true,
    orderNumber: order.orderNumber,
    id: order.id,
    thankYouToken: order.thankYouToken,
    paymentUrl: null,
  }
}

export async function updateOrderStatus(id: string, status: string) {
  // Для отмены — требуется право orders.cancel, иначе — обычное обновление статуса.
  const permission = status === "cancelled" ? "orders.cancel" : "orders.updateStatus"
  const admin = await requireAdmin(permission)

  const previous = await prisma.order.findUnique({ where: { id }, select: { status: true } })
  await updateOrderStatusDAL(id, status, admin.userId)
  void logAdminAction({
    admin,
    action: status === "cancelled" ? "order.cancelled" : "order.status_changed",
    entityType: "order",
    entityId: id,
    payload: { from: previous?.status, to: status },
  })

  // Email + bonus + shipment. Email-блок обрабатывает и гостей и зарегистрированных;
  // bonuses/createShipment живут под if (userId)/paymentMethod соответственно.
  try {
    const order = await getOrderById(id)
    if (order) {
      const user = order.userId
        ? await prisma.user.findUnique({
            where: { id: order.userId },
            select: { email: true, name: true, notifyOrderStatus: true },
          })
        : null

      // Send email only for customer-visible statuses — non-blocking via after().
      // Используем order.customerEmail (есть и у гостей), notifyOrderStatus — только если есть user.
      const customerVisibleStatuses = ["paid", "confirmed", "shipped", "delivered", "cancelled"]
      const recipient = order.customerEmail
      const mayNotify = user ? user.notifyOrderStatus : true
      if (recipient && mayNotify && customerVisibleStatuses.includes(status)) {
        const renderArgs = {
          customerName: order.customerName || user?.name || "Клиент",
          orderNumber: order.orderNumber,
          newStatus: status,
        }
        const orderIdForEmail = order.id
        after(async () => {
          await dispatchEmail({
            orderId: orderIdForEmail,
            kind: `order.status:${status}` as const,
            recipient,
            render: () => renderOrderStatusEmail(renderArgs),
            send: sendRenderedEmail,
          })
        })
      }

      // Credit bonuses on delivery — только для зарегистрированных.
      if (status === "delivered" && order.userId) {
        await creditBonusesForOrder(order.userId, order.id, order.total)
      }

      // Auto-create shipment when order is confirmed (COD) — не зависит от userId.
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
  const admin = await requireAdmin("orders.editNotes")
  void logAdminAction({
    admin,
    action: "order.notes_updated",
    entityType: "order",
    entityId: orderId,
  })

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

  const stockResults: StockAdjustResult[] = []
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

    // Возврат остатков через adjustStock — фиксируется в истории
    for (const item of order.items) {
      if (item.variantId) {
        const res = await adjustStock(
          {
            variantId: item.variantId,
            delta: +item.quantity,
            reason: "order_cancelled",
            orderId: order.id,
            changedBy: "customer",
          },
          tx
        )
        stockResults.push(res)
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

  if (stockResults.length > 0) {
    void notifyStockChanges(stockResults)
  }

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
