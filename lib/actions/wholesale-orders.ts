"use server"

import { revalidatePath } from "next/cache"
import { after } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireWholesale } from "@/lib/wholesale-guard"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"
import { createOrder, UnavailableItemsError, updateOrderStatus } from "@/lib/dal/orders"
import {
  resolvePrices,
  resolveTierDiscount,
  parseWeightGrams,
  getWeightTiers,
  pickTier,
} from "@/lib/dal/pricing"
import { getVariantPricesForRefresh } from "@/lib/dal/wholesale-catalog"
import { dispatchEmail } from "@/lib/dal/email-dispatch"
import { sendRenderedEmail, getWholesaleNotificationEmails } from "@/lib/email"
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
 * Refresh корзины — пересчёт базовых цен, stock, валидация минимумов.
 * Клиент вызывает перед открытием checkout и при смене количества.
 * Tier-скидка считается отдельно через getCartTierPreview на базе весов.
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

/**
 * Возвращает все тиры прайс-листа компании + применённый/следующий для
 * заданного веса корзины. Используется в /wholesale/catalog, /cart и /checkout
 * для визуализации «до -5% осталось 3.2 кг».
 */
export async function getCartTierPreview(totalWeightGrams: number) {
  const ctx = await requireWholesale()
  const tiers = ctx.company.priceListId ? await getWeightTiers(ctx.company.priceListId) : []
  const picked = pickTier(tiers, totalWeightGrams)
  return { tiers, ...picked }
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

  // 2) Субтотал по базовым (розничным для weight_tier) ценам
  const grossSubtotal = input.items.reduce((sum, item) => {
    const priced = priceMap.get(item.variantId)!
    return sum + priced.price * item.quantity
  }, 0)

  // 3) Tier-скидка от суммарного веса корзины. Для non-weight_tier прайс-листов
  // applied=null, скидки нет (цены уже в priceMap с учётом item-override).
  const totalWeightGrams = input.items.reduce(
    (sum, item) => sum + parseWeightGrams(item.weight) * item.quantity,
    0
  )
  const tier = await resolveTierDiscount(ctx.company.priceListId, totalWeightGrams)
  const tierDiscountValue = Math.round((grossSubtotal * tier.discountPct) / 100)
  const subtotal = grossSubtotal - tierDiscountValue

  // 4) Проверка minOrderSum прайс-листа
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

  // 5) Любой оптовый заказ обязательно проходит через подтверждение менеджера.
  //    Никакой ЮKassa-оплаты, никаких кредит-лимитов. Схема:
  //    submit → pending_approval (товар зарезервирован) → менеджер approve →
  //    автогенерация счёта (с доставкой отдельной строкой) → клиент оплачивает
  //    по платёжному поручению → менеджер помечает paid → отгрузка.
  const paymentTerms = "invoice"
  const approvalStatus = "pending_approval"

  // 6) Загружаем snapshot реквизитов компании
  const company = await prisma.wholesaleCompany.findUnique({
    where: { id: ctx.companyId },
    select: { legalName: true, inn: true, kpp: true, contactPhone: true, contactName: true },
  })

  // 7) Собираем OrderData. Для weight_tier — применяем процент к каждой
  // позиции пропорционально (round-down на копейках идёт в пользу компании —
  // клиент видит чуть более мягкое снижение).
  const applyTier = tier.discountPct > 0
  const orderItems = input.items.map((item) => {
    const basePrice = priceMap.get(item.variantId)!.price
    const finalPrice = applyTier
      ? Math.round(basePrice * (1 - tier.discountPct / 100))
      : basePrice
    return {
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      weight: item.weight,
      price: finalPrice,
      quantity: item.quantity,
    }
  })

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
      paymentMethod: "invoice",
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
          subject: `Заявка ${orderNumber} принята на рассмотрение`,
          html: `
            <h2>Ваша заявка принята</h2>
            <p>Здравствуйте, ${ctx.name}!</p>
            <p>Заявка <strong>${orderNumber}</strong> на сумму <strong>${total.toLocaleString("ru")}₽</strong> (без учёта доставки) передана нашему менеджеру.</p>
            <p>Товар зарезервирован на складе. После подтверждения менеджером мы сформируем
            счёт с учётом доставки и вышлем вам PDF на ${ctx.email}. Оплата — по платёжному поручению.</p>
            <p>Менеджер свяжется с вами в течение рабочего дня.</p>
          `,
        }),
        send: (email) => sendRenderedEmail(email),
      }).catch(() => {})

      // Админы + оптовый менеджер (tradeagent@kldrefine.com)
      for (const adminEmail of getWholesaleNotificationEmails()) {
        await dispatchEmail({
          orderId: order.id,
          kind: "wholesale.admin.new_order",
          recipient: adminEmail,
          render: () => ({
            subject: `[ОПТ] Новая заявка ${orderNumber} от ${company?.legalName ?? ctx.name}`,
            html: `
              <h2>Новая заявка — требует подтверждения</h2>
              <p><strong>Компания:</strong> ${company?.legalName ?? "—"} (ИНН ${company?.inn ?? "—"})</p>
              <p><strong>Контакт:</strong> ${ctx.name}, ${input.contactPhone || company?.contactPhone || "—"}, ${ctx.email}</p>
              <p><strong>Номер заявки:</strong> ${orderNumber}</p>
              <p><strong>Сумма товаров:</strong> ${total.toLocaleString("ru")}₽${tier.discountPct > 0 ? ` (применена скидка по весу ${tier.discountPct}%, вес ${(totalWeightGrams / 1000).toFixed(1)} кг)` : ""}</p>
              <p><strong>Доставка:</strong> ${input.deliveryMethod ?? "—"}${input.deliveryType ? ` (${input.deliveryType})` : ""}, ${input.destinationCity ?? input.deliveryAddress}</p>
              <p><strong>Товар зарезервирован на складе до вашего решения.</strong></p>
              <p><a href="${process.env.NEXTAUTH_URL || ""}/admin/orders/${order.id}">Открыть заявку в админке</a> — подтвердить / отклонить.</p>
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
    throw new Error("Заявка не требует подтверждения")
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      approvalStatus: "approved",
      approvedById: admin.userId,
      approvedAt: new Date(),
      // Заказ переходит в confirmed — товар резервируется, ждём оплату по счёту.
      status: "confirmed",
    },
  })

  void logAdminAction({
    admin,
    action: "wholesale.order.approved",
    entityType: "order",
    entityId: orderId,
    payload: { orderNumber: order.orderNumber, total: order.total },
  })

  // Автогенерация PDF-счёта и email клиенту. Импорт динамический — модуль
  // тяжёлый (react-pdf), не нужен при других подобных actions.
  after(async () => {
    let invoicePdfUrl: string | null = null
    let invoiceNumber: string | null = null
    try {
      const mod = await import("@/lib/actions/wholesale-invoices")
      const invoice = await mod.generateInvoiceForOrder(orderId, { kind: "invoice" })
      invoicePdfUrl = invoice.pdfUrl
      invoiceNumber = invoice.number
    } catch (e) {
      console.error("[approve] auto-generate invoice failed:", e)
    }

    if (order.customerEmail) {
      const nextAuthUrl = process.env.NEXTAUTH_URL || ""
      await dispatchEmail({
        orderId,
        kind: "wholesale.order.approved",
        recipient: order.customerEmail,
        render: () => ({
          subject: `Счёт на оплату — заявка ${order.orderNumber}`,
          html: `
            <h2>Заявка подтверждена, счёт готов</h2>
            <p>Ваша заявка <strong>${order.orderNumber}</strong> подтверждена менеджером.</p>
            <p><strong>К оплате: ${order.total.toLocaleString("ru")}₽</strong> (товары + доставка ${order.deliveryPrice.toLocaleString("ru")}₽).</p>
            ${invoicePdfUrl ? `<p><a href="${nextAuthUrl}${invoicePdfUrl}">📄 Скачать счёт ${invoiceNumber} (PDF)</a></p>` : "<p>Счёт формируется, скоро придёт отдельным письмом.</p>"}
            <p>После поступления 100% оплаты по этому счёту мы сформируем доставку.</p>
            <p><a href="${nextAuthUrl}/wholesale/orders/${orderId}">Открыть заявку в кабинете</a></p>
          `,
        }),
        send: (email) => sendRenderedEmail(email),
      }).catch(() => {})
    }

    await enqueueOutbox(
      "wholesale.order.approved",
      {
        event_id: `wh_order_approved_${orderId}`,
        event: "wholesale.order.approved",
        occurred_at: new Date().toISOString(),
        order: {
          id: orderId,
          number: order.orderNumber,
          total: order.total,
          invoice_url: invoicePdfUrl,
          invoice_number: invoiceNumber,
        },
      },
      { eventId: `wh_order_approved_${orderId}` }
    ).catch(() => {})
  })

  revalidatePath("/admin/wholesale/orders")
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/wholesale/orders/${orderId}`)
  return updated
}

export async function rejectWholesaleOrder(orderId: string, reason: string) {
  const admin = await requireAdmin("wholesale.orders.approve")

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw new Error("Заказ не найден")
  if (order.channel !== "wholesale") throw new Error("Это не оптовый заказ")
  // Отклонить можно только заявку, которая ещё не обработана.
  // После approve счёт уже сформирован и, возможно, отправлен клиенту —
  // нельзя тихо отменять такой заказ этим флоу. Для отмены после approve
  // менеджер должен использовать обычный updateOrderStatus → cancelled,
  // что задокументирует отмену с полным audit trail.
  if (order.approvalStatus !== "pending_approval") {
    throw new Error(
      "Отклонить можно только заявку в статусе «ожидает подтверждения». " +
        "Для отмены уже одобренного заказа используйте смену статуса → Отменён."
    )
  }

  // Отмена через общий updateOrderStatus — возвращает stock.
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

  // Email клиенту — отказ
  if (order.customerEmail) {
    after(async () => {
      await dispatchEmail({
        orderId,
        kind: "wholesale.order.rejected",
        recipient: order.customerEmail!,
        render: () => ({
          subject: `Заявка ${order.orderNumber} отклонена`,
          html: `
            <h2>Заявка отклонена</h2>
            <p>К сожалению, мы не можем подтвердить заявку <strong>${order.orderNumber}</strong>.</p>
            ${reason ? `<p><strong>Причина:</strong> ${reason}</p>` : ""}
            <p>Товар возвращён на склад. Если есть вопросы — напишите менеджеру.</p>
          `,
        }),
        send: (email) => sendRenderedEmail(email),
      }).catch(() => {})
    })
  }

  revalidatePath("/admin/wholesale/orders")
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/wholesale/orders/${orderId}`)
  return { ok: true }
}

/**
 * Менеджер получил оплату по счёту → помечает заказ paid → переходит к отгрузке.
 * Никаких credit-транзакций — кредит-механика убрана.
 */
export async function markWholesaleOrderPaid(orderId: string) {
  const admin = await requireAdmin("wholesale.orders.updateStatus")

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) throw new Error("Заказ не найден")
  if (order.channel !== "wholesale") throw new Error("Это не оптовый заказ")
  if (order.paymentStatus === "succeeded") {
    throw new Error("Оплата уже зафиксирована")
  }
  if (order.approvalStatus !== "approved") {
    throw new Error("Сначала подтвердите заявку")
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: "succeeded",
      paymentMethod: "invoice",
    },
  })

  void logAdminAction({
    admin,
    action: "wholesale.order.paid",
    entityType: "order",
    entityId: orderId,
    payload: { orderNumber: order.orderNumber, amount: order.total },
  })

  // Email клиенту: оплата получена, формируется доставка
  if (order.customerEmail) {
    after(async () => {
      await dispatchEmail({
        orderId,
        kind: "wholesale.order.paid",
        recipient: order.customerEmail!,
        render: () => ({
          subject: `Оплата по заказу ${order.orderNumber} получена`,
          html: `
            <h2>Оплата получена — формируем доставку</h2>
            <p>Подтверждаем получение оплаты по заказу <strong>${order.orderNumber}</strong> на сумму <strong>${order.total.toLocaleString("ru")}₽</strong>.</p>
            <p>Готовим отгрузку. Ожидайте трек-номер.</p>
          `,
        }),
        send: (email) => sendRenderedEmail(email),
      }).catch(() => {})
    })
  }

  revalidatePath("/admin/wholesale/orders")
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/wholesale/orders/${orderId}`)
  return { ok: true }
}

