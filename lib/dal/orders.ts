import crypto from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { OrderData } from "@/lib/types"
import { validatePromoCode } from "@/lib/dal/promo-codes"
import { deductBonusesInTx, reverseOrderEarnedBonuses } from "@/lib/dal/bonuses"
import { calculateDeliveryRates, buildPackagePlan, type ItemToPack } from "@/lib/delivery"
import { adjustStock, type StockAdjustResult } from "@/lib/dal/stock"
import { notifyStockChanges } from "@/lib/integrations/stock-alerts"

function parseItemWeightGrams(w: string): number {
  const lower = w.toLowerCase().trim()
  const match = lower.match(/^([\d.,]+)\s*(кг|г|kg|g)?$/)
  if (!match) return 0
  const n = parseFloat(match[1].replace(",", "."))
  if (isNaN(n)) return 0
  const unit = match[2] || "г"
  return unit === "кг" || unit === "kg" ? Math.round(n * 1000) : Math.round(n)
}

function generateOrderNumber(): string {
  const date = new Date()
  const datePart = date.toISOString().slice(2, 10).replace(/-/g, "")
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `MC-${datePart}-${randomPart}`
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export interface UnavailableItemDetail {
  variantId: string
  productId: string
  name: string
  requested: number
  available: number
  reason: "out_of_stock" | "insufficient_stock" | "inactive" | "price_changed"
}

/**
 * Выбрасывается при попытке оформить заказ с товарами, которых больше нет
 * в наличии (либо изменилась цена). Клиент на checkout ловит это и
 * показывает модалку "Убрать из корзины и продолжить" вместо generic-ошибки.
 */
export class UnavailableItemsError extends Error {
  constructor(public items: UnavailableItemDetail[]) {
    super("Some items are unavailable")
    this.name = "UnavailableItemsError"
  }
}

export async function createOrder(data: OrderData) {
  // Validate prices and stock availability before proceeding.
  // Собираем ВСЕ недоступные сразу, чтобы клиент увидел полный список
  // (а не только первую проблему), и смог единым кликом убрать их все.
  const unavailable: UnavailableItemDetail[] = []
  for (const item of data.items) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      select: { price: true, stock: true, isActive: true, product: { select: { name: true } } },
    })
    if (!variant || !variant.isActive) {
      unavailable.push({
        variantId: item.variantId,
        productId: item.productId,
        name: item.name,
        requested: item.quantity,
        available: 0,
        reason: "inactive",
      })
      continue
    }
    if (variant.price !== item.price) {
      unavailable.push({
        variantId: item.variantId,
        productId: item.productId,
        name: item.name,
        requested: item.quantity,
        available: variant.stock,
        reason: "price_changed",
      })
      continue
    }
    if (variant.stock < item.quantity) {
      unavailable.push({
        variantId: item.variantId,
        productId: item.productId,
        name: item.name,
        requested: item.quantity,
        available: variant.stock,
        reason: variant.stock === 0 ? "out_of_stock" : "insufficient_stock",
      })
    }
  }
  if (unavailable.length > 0) {
    throw new UnavailableItemsError(unavailable)
  }

  const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  let discount = 0
  let promoCodeId: string | null = null

  if (data.promoCode) {
    const result = await validatePromoCode(data.promoCode, subtotal, data.userId)
    if (result.valid && result.promo && result.discount) {
      discount = result.discount
      promoCodeId = result.promo.id
    }
  }

  const afterDiscount = subtotal - discount

  // Bonus deduction: validate and cap at 50%
  let bonusUsed = 0
  if (data.bonusAmount && data.bonusAmount > 0 && data.userId) {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { bonusBalance: true },
    })
    const maxBonus = Math.floor(afterDiscount * 0.5)
    bonusUsed = Math.min(data.bonusAmount, maxBonus, user?.bonusBalance ?? 0)
  }

  // Позиции для расчёта плана упаковки и, соответственно, цены доставки
  const packingItems: ItemToPack[] = data.items
    .map((i) => ({ weightGrams: parseItemWeightGrams(i.weight), quantity: i.quantity }))
    .filter((i) => i.weightGrams > 0 && i.quantity > 0)

  // Строим физический план упаковки — сохраняем в заказ для прозрачности отгрузки.
  const packagePlan = packingItems.length > 0 ? await buildPackagePlan(packingItems) : null
  const totalPackageWeight = packagePlan
    ? packagePlan.reduce((s, p) => s + p.weight, 0)
    : null

  // Delivery price: always calculate server-side, never trust client price.
  // Передаём ВСЕ доступные параметры локации (город-строка нужен для Почты,
  // когда у клиента нет postalCode — провайдер разрешает через DaData/by-address).
  let deliveryPrice = 0
  if (data.tariffCode !== undefined && data.deliveryMethod) {
    const rates = await calculateDeliveryRates({
      toCityCode: data.destinationCityCode,
      toPostalCode: data.postalCode,
      toCity: data.destinationCity,
      items: packingItems,
      cartTotal: afterDiscount - bonusUsed,
    })
    const matchingRate = rates.find(
      (r) => r.tariffCode === data.tariffCode && r.carrier === data.deliveryMethod
    )
    if (!matchingRate) {
      throw new Error(
        `Выбранный тариф ${data.deliveryMethod}/${data.tariffCode} недоступен. ` +
          `Провайдеры вернули: ${rates.map((r) => `${r.carrier}/${r.tariffCode}`).join(", ") || "ничего"}. ` +
          `Обновите страницу и выберите доставку заново`
      )
    }
    deliveryPrice = matchingRate.priceWithMarkup
  }
  const total = afterDiscount - bonusUsed + deliveryPrice

  const order = await prisma.$transaction(async (tx) => {
    // Atomically verify and increment promo usage inside the transaction.
    // Pre-validation (above) is advisory; this is the real guard against race conditions.
    if (promoCodeId) {
      const affected = await tx.$executeRaw`
        UPDATE "PromoCode"
        SET "usageCount" = "usageCount" + 1
        WHERE id = ${promoCodeId}
          AND "isActive" = true
          AND "endDate" > NOW()
          AND ("maxUsage" IS NULL OR "usageCount" < "maxUsage")
      `
      if (affected === 0) {
        throw new Error("Промокод недействителен или исчерпан. Попробуйте оформить заказ без него")
      }
    }

    const created = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        thankYouToken: generateToken(),
        trackingToken: generateToken(),
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        deliveryAddress: data.deliveryAddress,
        deliveryMethod: data.deliveryMethod,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        userId: data.userId,
        subtotal,
        discount,
        deliveryPrice,
        total,
        bonusUsed,
        promoCodeId,
        // Delivery module fields
        deliveryType: data.deliveryType,
        pickupPointCode: data.pickupPointCode,
        pickupPointName: data.pickupPointName,
        destinationCity: data.destinationCity,
        destinationCityCode: data.destinationCityCode,
        estimatedDelivery: data.estimatedDelivery,
        tariffCode: data.tariffCode,
        postalCode: data.postalCode,
        packagePlan: (packagePlan ?? undefined) as Prisma.InputJsonValue | undefined,
        packageWeight: totalPackageWeight ?? undefined,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            weight: item.weight,
            price: item.price,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: true },
    })

    // Декремент остатков через adjustStock — атомарно, с историей и пересечением порогов.
    const stockResults: StockAdjustResult[] = []
    for (const item of data.items) {
      try {
        const res = await adjustStock(
          {
            variantId: item.variantId,
            delta: -item.quantity,
            reason: "order_placed",
            orderId: created.id,
            changedBy: data.userId || "customer",
          },
          tx
        )
        stockResults.push(res)
      } catch (e) {
        throw new Error(
          e instanceof Error && e.message.startsWith("Недостаточно")
            ? `"${item.name}" — недостаточно на складе. Обновите корзину`
            : `Ошибка списания со склада для "${item.name}"`
        )
      }
    }

    // Deduct bonuses with real orderId (after order is created)
    if (bonusUsed > 0 && data.userId) {
      await deductBonusesInTx(tx, data.userId, created.id, bonusUsed)
    }

    return { created, stockResults }
  })

  // После commit — асинхронно уведомляем millorbot о критичных переходах
  void notifyStockChanges(order.stockResults)

  return order.created
}

export async function getOrders(filters: { status?: string; search?: string; page?: number; limit?: number } = {}) {
  const { status, search, page = 1, limit = 20 } = filters

  const conditions: Record<string, unknown>[] = []
  if (status) conditions.push({ status })
  if (search) {
    conditions.push({
      OR: [
        { orderNumber: { contains: search, mode: "insensitive" as const } },
        { customerPhone: { contains: search } },
        { customerEmail: { contains: search, mode: "insensitive" as const } },
        { customerName: { contains: search, mode: "insensitive" as const } },
      ],
    })
  }
  const where = conditions.length > 0 ? { AND: conditions } : {}

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  return { orders, total }
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: { select: { name: true, slug: true } },
        },
      },
      promoCode: {
        select: { code: true, name: true, type: true, value: true },
      },
      statusLogs: {
        orderBy: { createdAt: "desc" },
      },
    },
  })
}

export async function getOrdersByUserId(userId: string, { page = 1, limit = 10 } = {}) {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        items: true,
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where: { userId } }),
  ])

  return { orders, total }
}

/**
 * Строгая state-machine заказа (P1-13).
 *
 * Правила:
 * - pending → paid | confirmed | cancelled
 * - paid → confirmed | shipped | cancelled
 * - confirmed → shipped | cancelled
 * - shipped → delivered | cancelled (cancelled редкий — например, посылка
 *   утеряна перевозчиком; stock при этом НЕ возвращается, товар физически
 *   уехал)
 * - delivered — terminal: никаких обратных переходов. Если нужно
 *   аннулировать — только через админ SQL или отдельный "returned" flow.
 * - cancelled — terminal: нельзя восстановить в pending. Раньше можно было,
 *   но это приводило к двойным рассылкам и неконсистентным stock-adjustments.
 *   Если нужно оформить заказ снова — клиент делает новый.
 * - payment_failed → pending | cancelled (pending даёт shot у повторной
 *   оплаты в течение сессии; чаще же идёт в cancelled).
 */
export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["paid", "confirmed", "cancelled"],
  paid: ["confirmed", "shipped", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  payment_failed: ["pending", "cancelled"],
}

export async function updateOrderStatus(id: string, status: string, changedBy?: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { select: { variantId: true, quantity: true, name: true } } },
  })
  if (!order) throw new Error("Заказ не найден")

  const allowed = ALLOWED_TRANSITIONS[order.status] || []
  if (!allowed.includes(status)) {
    throw new Error(`Нельзя перевести заказ из "${order.status}" в "${status}"`)
  }

  // P1-14: если заказ был delivered и bonusEarned > 0, при любом переходе
  // в cancelled/returned нужно списать начисленные бонусы, иначе юзер
  // получает cashback за не полученный товар. Сейчас ALLOWED_TRANSITIONS
  // запрещает delivered → что-либо, но держим safeguard на случай
  // расширения матрицы в будущем.
  if (
    status === "cancelled" &&
    order.userId &&
    order.bonusEarned > 0 &&
    ["shipped", "delivered"].includes(order.status)
  ) {
    await reverseOrderEarnedBonuses(order.userId, id)
  }

  // Stock-side-effect: возвращаем товар на склад только если заказ отменяем
  // ДО отгрузки (pending/paid/confirmed → cancelled). При shipped → cancelled
  // stock НЕ трогаем — товар уже едет/уехал; если будет возврат, админ
  // сделает adjustStock вручную через отдельный возвратный flow.
  const isCancellingBeforeShipment =
    status === "cancelled" && ["pending", "paid", "confirmed"].includes(order.status)

  const stockResults: StockAdjustResult[] = []

  const updated = await prisma.$transaction(async (tx) => {
    if (isCancellingBeforeShipment) {
      for (const item of order.items) {
        if (!item.variantId) continue
        const res = await adjustStock(
          {
            variantId: item.variantId,
            delta: +item.quantity,
            reason: "order_cancelled",
            orderId: id,
            changedBy: changedBy || "admin",
          },
          tx
        )
        stockResults.push(res)
      }
    }

    const upd = await tx.order.update({
      where: { id },
      data: { status },
    })
    await tx.orderStatusLog.create({
      data: {
        orderId: id,
        fromStatus: order.status,
        toStatus: status,
        changedBy: changedBy || null,
      },
    })
    return upd
  })

  if (stockResults.length > 0) {
    void notifyStockChanges(stockResults)
  }
  return updated
}
