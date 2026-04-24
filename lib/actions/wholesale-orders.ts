"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWholesale } from "@/lib/wholesale-guard"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"
import { createOrder, UnavailableItemsError, updateOrderStatus } from "@/lib/dal/orders"
import { resolvePrices } from "@/lib/dal/pricing"
import { getVariantPricesForRefresh } from "@/lib/dal/wholesale-catalog"
import { dispatchEmail } from "@/lib/dal/email-dispatch"
import { sendRenderedEmail, getAdminNotificationEmails } from "@/lib/email"
import { enqueueOutbox } from "@/lib/dal/outbox"

const PAYMENT_TERM_DAYS: Record<string, number> = {
  prepay: 0,
  net7: 7,
  net14: 14,
  net30: 30,
  net60: 60,
}

export interface WholesaleCheckoutItem {
  productId: string
  variantId: string
  name: string
  weight: string
  quantity: number
}

export interface WholesaleCheckoutInput {
  items: WholesaleCheckoutItem[]
  deliveryAddress: string
  deliveryMethod?: "cdek" | "pochta" | "courier"
  deliveryType?: "door" | "pvz"
  pickupPointCode?: string
  pickupPointName?: string
  destinationCity?: string
  destinationCityCode?: string
  estimatedDelivery?: string
  tariffCode?: number
  postalCode?: string
  notes?: string
  contactPhone?: string
  contactName?: string
}

/**
 * Refresh корзины — пересчёт цен, stock, валидация минимумов.
 * Клиент вызывает перед открытием checkout и при смене количества.
 */
export async function refreshWholesaleCart(variantIds: string[]) {
  const ctx = await requireWholesale()
  const prices = await getVariantPricesForRefresh(variantIds, {
    channel: "wholesale",
    priceListId: ctx.company.priceListId,
    companyId: ctx.companyId,
  })
  return Object.fromEntries(prices)
}

export async function submitWholesaleOrder(input: WholesaleCheckoutInput) {
  const ctx = await requireWholesale()

  if (!input.items.length) throw new Error("Корзина пуста")

  // 1) Серверный пересчёт цен — никогда не доверяем клиенту.
  const priceMap = await resolvePrices(
    input.items.map((i) => i.variantId),
    { channel: "wholesale", priceListId: ctx.company.priceListId, companyId: ctx.companyId }
  )

  for (const item of input.items) {
    const priced = priceMap.get(item.variantId)
    if (!priced) {
      throw new Error(`Товар ${item.name} больше недоступен`)
    }
    if (item.quantity < priced.minQuantity) {
      throw new Error(`Минимальный заказ для "${item.name}" — ${priced.minQuantity} шт.`)
    }
  }

  // 2) Проверка minOrderSum прайс-листа
  const subtotal = input.items.reduce((sum, item) => {
    const priced = priceMap.get(item.variantId)!
    return sum + priced.price * item.quantity
  }, 0)

  if (ctx.company.priceListId) {
    const priceList = await prisma.priceList.findUnique({
      where: { id: ctx.company.priceListId },
      select: { minOrderSum: true, name: true },
    })
    if (priceList?.minOrderSum && subtotal < priceList.minOrderSum) {
      throw new Error(
        `Минимальная сумма заказа по прайсу «${priceList.name}» — ${priceList.minOrderSum}₽. Сейчас: ${subtotal}₽.`
      )
    }
  }

  // 3) Net-terms: проверить кредитный лимит
  const paymentTerms = ctx.company.paymentTerms
  const isNetTerms = paymentTerms !== "prepay"
  const approvalStatus = isNetTerms ? "pending_approval" : null

  if (isNetTerms) {
    const available = ctx.company.creditLimit - ctx.company.creditUsed
    if (subtotal > available) {
      throw new Error(
        `Превышен кредитный лимит. Доступно: ${available}₽, сумма заказа: ${subtotal}₽. ` +
          `Оплатите предыдущие счета или свяжитесь с менеджером.`
      )
    }
  }

  // 4) Загружаем snapshot реквизитов компании
  const company = await prisma.wholesaleCompany.findUnique({
    where: { id: ctx.companyId },
    select: { legalName: true, inn: true, kpp: true, contactPhone: true, contactName: true },
  })

  // 5) Собираем OrderData и делегируем в общий createOrder
  const orderItems = input.items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId,
    name: item.name,
    weight: item.weight,
    price: priceMap.get(item.variantId)!.price,
    quantity: item.quantity,
  }))

  try {
    const order = await createOrder({
      channel: "wholesale",
      customerName: input.contactName || company?.contactName || ctx.name,
      customerEmail: ctx.email,
      customerPhone: input.contactPhone || company?.contactPhone || "+79000000000",
      deliveryAddress: input.deliveryAddress,
      deliveryMethod: input.deliveryMethod,
      deliveryType: input.deliveryType,
      pickupPointCode: input.pickupPointCode,
      pickupPointName: input.pickupPointName,
      destinationCity: input.destinationCity,
      destinationCityCode: input.destinationCityCode,
      estimatedDelivery: input.estimatedDelivery,
      tariffCode: input.tariffCode,
      postalCode: input.postalCode,
      notes: input.notes,
      paymentMethod: isNetTerms ? "postpay" : "online",
      wholesaleCompanyId: ctx.companyId,
      wholesaleUserId: ctx.userId,
      paymentTerms,
      approvalStatus,
      b2bLegalName: company?.legalName ?? undefined,
      b2bInn: company?.inn ?? undefined,
      b2bKpp: company?.kpp ?? undefined,
      items: orderItems,
    })

    const orderNumber = order.orderNumber
    const total = order.total

    // Async: email + Millorbot event
    after(async () => {
      await dispatchEmail({
        orderId: order.id,
        kind: "wholesale.order.confirmation",
        recipient: ctx.email,
        render: () => ({
          subject: `Заказ ${orderNumber} принят`,
          html: `
            <h2>Ваш оптовый заказ принят</h2>
            <p>Здравствуйте, ${ctx.name}!</p>
            <p>Мы зарегистрировали заказ <strong>${orderNumber}</strong> на сумму <strong>${total}₽</strong>.</p>
            <p><strong>Условия оплаты:</strong> ${paymentTerms === "prepay" ? "Предоплата" : `Отсрочка ${PAYMENT_TERM_DAYS[paymentTerms]} дней`}</p>
            ${approvalStatus === "pending_approval" ? "<p>Заказ ожидает подтверждения менеджером.</p>" : ""}
            <p>Мы свяжемся с вами для уточнения деталей.</p>
          `,
        }),
        send: (email) => sendRenderedEmail(email),
      }).catch(() => {})

      // Админам
      for (const adminEmail of getAdminNotificationEmails()) {
        await dispatchEmail({
          orderId: order.id,
          kind: "wholesale.admin.new_order",
          recipient: adminEmail,
          render: () => ({
            subject: `[ОПТ] Новый заказ ${orderNumber} от ${company?.legalName ?? ctx.name}`,
            html: `
              <h2>Новый оптовый заказ</h2>
              <p><strong>Компания:</strong> ${company?.legalName ?? "—"} (ИНН ${company?.inn ?? "—"})</p>
              <p><strong>Номер:</strong> ${orderNumber}</p>
              <p><strong>Сумма:</strong> ${total}₽</p>
              <p><strong>Условия:</strong> ${paymentTerms}</p>
              <p><strong>Доставка:</strong> ${input.deliveryAddress}</p>
              <p><a href="${process.env.NEXTAUTH_URL || ""}/admin/orders/${order.id}">Открыть в админке</a></p>
            `,
          }),
          send: (email) => sendRenderedEmail(email),
        }).catch(() => {})
      }

      await enqueueOutbox(
        "wholesale.order.created",
        {
          event_id: `wh_order_created_${order.id}`,
          event: "wholesale.order.created",
          occurred_at: new Date().toISOString(),
          order: {
            id: order.id,
            number: orderNumber,
            total,
            subtotal: order.subtotal,
            paymentTerms,
            approvalStatus,
            itemsCount: orderItems.length,
            admin_url: `/admin/orders/${order.id}`,
          },
          company: {
            id: ctx.companyId,
            legalName: company?.legalName,
            inn: company?.inn,
          },
          user: {
            id: ctx.userId,
            name: ctx.name,
            email: ctx.email,
          },
        },
        { eventId: `wh_order_created_${order.id}` }
      ).catch(() => {})
    })

    revalidatePath("/wholesale/orders")
    revalidatePath("/wholesale")
    revalidatePath("/admin/orders")
    revalidatePath("/admin/wholesale/orders")

    return {
      success: true as const,
      orderId: order.id,
      orderNumber: order.orderNumber,
      thankYouToken: order.thankYouToken,
      approvalStatus,
      total: order.total,
    }
  } catch (e) {
    if (e instanceof UnavailableItemsError) {
      return { success: false as const, unavailable: e.items }
    }
    throw e
  }
}

export async function approveWholesaleOrder(orderId: string) {
  const admin = await requireAdmin("wholesale.orders.approve")

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw new Error("Заказ не найден")
  if (order.channel !== "wholesale") throw new Error("Это не оптовый заказ")
  if (order.approvalStatus !== "pending_approval") {
    throw new Error("Заказ не требует подтверждения")
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      approvalStatus: "approved",
      approvedById: admin.userId,
      approvedAt: new Date(),
      status: order.status === "pending" ? "confirmed" : order.status,
    },
  })

  void logAdminAction({
    admin,
    action: "wholesale.order.approved",
    entityType: "order",
    entityId: orderId,
    payload: { orderNumber: order.orderNumber, total: order.total },
  })

  // Notify клиента + Millorbot
  if (order.customerEmail) {
    after(async () => {
      await dispatchEmail({
        orderId,
        kind: "wholesale.order.approved",
        recipient: order.customerEmail!,
        render: () => ({
          subject: `Заказ ${order.orderNumber} одобрен к отгрузке`,
          html: `<p>Ваш заказ <strong>${order.orderNumber}</strong> одобрен и готовится к отправке.</p>`,
        }),
        send: (email) => sendRenderedEmail(email),
      }).catch(() => {})

      await enqueueOutbox(
        "wholesale.order.approved",
        {
          event_id: `wh_order_approved_${orderId}`,
          event: "wholesale.order.approved",
          occurred_at: new Date().toISOString(),
          order: { id: orderId, number: order.orderNumber, total: order.total },
        },
        { eventId: `wh_order_approved_${orderId}` }
      ).catch(() => {})
    })
  }

  revalidatePath("/admin/wholesale/orders")
  revalidatePath(`/admin/orders/${orderId}`)
  return updated
}

export async function rejectWholesaleOrder(orderId: string, reason: string) {
  const admin = await requireAdmin("wholesale.orders.approve")

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw new Error("Заказ не найден")
  if (order.channel !== "wholesale") throw new Error("Это не оптовый заказ")

  // Отмена через общий updateOrderStatus: он вернёт stock + credit reversal
  await updateOrderStatus(orderId, "cancelled", admin.userId)
  await prisma.order.update({
    where: { id: orderId },
    data: { approvalStatus: "rejected" },
  })

  void logAdminAction({
    admin,
    action: "wholesale.order.rejected",
    entityType: "order",
    entityId: orderId,
    payload: { orderNumber: order.orderNumber, reason },
  })

  revalidatePath("/admin/wholesale/orders")
  revalidatePath(`/admin/orders/${orderId}`)
  return { ok: true }
}

export async function markWholesaleOrderPaid(orderId: string) {
  const admin = await requireAdmin("wholesale.credit.adjust")

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw new Error("Заказ не найден")
  if (order.channel !== "wholesale") throw new Error("Это не оптовый заказ")
  if (!order.wholesaleCompanyId) throw new Error("Заказ не привязан к компании")

  const idempotencyKey = `credit:payment:order:${orderId}`

  // Проверим, был ли уже зафиксирован платёж по этому orderId
  const existing = await prisma.wholesaleCreditTransaction.findUnique({
    where: { idempotencyKey },
  })
  if (existing) {
    throw new Error("Оплата по этому заказу уже зарегистрирована")
  }

  await prisma.$transaction(async (tx) => {
    await tx.wholesaleCreditTransaction.create({
      data: {
        companyId: order.wholesaleCompanyId!,
        amount: -order.total,
        type: "payment_received",
        orderId,
        description: `Оплата заказа ${order.orderNumber}`,
        idempotencyKey,
        createdBy: admin.userId,
      },
    })
    await tx.wholesaleCompany.update({
      where: { id: order.wholesaleCompanyId! },
      data: { creditUsed: { decrement: order.total } },
    })
    await tx.order.update({
      where: { id: orderId },
      data: { paymentStatus: "succeeded" },
    })
  })

  void logAdminAction({
    admin,
    action: "wholesale.order.paid",
    entityType: "order",
    entityId: orderId,
    payload: { orderNumber: order.orderNumber, amount: order.total },
  })

  revalidatePath("/admin/wholesale/orders")
  revalidatePath(`/admin/orders/${orderId}`)
  return { ok: true }
}
