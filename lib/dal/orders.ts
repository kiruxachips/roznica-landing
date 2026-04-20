import crypto from "crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import type { OrderData } from "@/lib/types"
import { validatePromoCode } from "@/lib/dal/promo-codes"
import { deductBonusesInTx } from "@/lib/dal/bonuses"
import { calculateDeliveryRates, buildPackagePlan, type ItemToPack } from "@/lib/delivery"

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

export async function createOrder(data: OrderData) {
  // Validate prices and stock availability before proceeding
  for (const item of data.items) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: item.variantId },
      select: { price: true, stock: true, isActive: true, product: { select: { name: true } } },
    })
    if (!variant || !variant.isActive) {
      throw new Error(`Товар "${item.name}" недоступен`)
    }
    if (variant.price !== item.price) {
      throw new Error(`Цена на "${item.name}" изменилась. Обновите корзину`)
    }
    if (variant.stock < item.quantity) {
      throw new Error(
        variant.stock === 0
          ? `"${item.name}" нет в наличии`
          : `"${item.name}" — доступно только ${variant.stock} шт.`
      )
    }
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

  // Delivery price: always calculate server-side, never trust client price
  let deliveryPrice = 0
  if (data.tariffCode !== undefined && data.deliveryMethod) {
    const rates = await calculateDeliveryRates({
      toCityCode: data.destinationCityCode,
      toPostalCode: data.postalCode,
      items: packingItems,
      cartTotal: afterDiscount - bonusUsed,
    })
    const matchingRate = rates.find(
      (r) => r.tariffCode === data.tariffCode && r.carrier === data.deliveryMethod
    )
    if (!matchingRate) {
      throw new Error("Выбранный тариф доставки недоступен. Обновите страницу и выберите доставку заново")
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

    // Atomically decrement stock — rejects if insufficient.
    // This is the real safety check (pre-validation above is advisory for UX).
    for (const item of data.items) {
      const affected = await tx.$executeRaw`
        UPDATE "ProductVariant"
        SET stock = stock - ${item.quantity}
        WHERE id = ${item.variantId} AND stock >= ${item.quantity}
      `
      if (affected === 0) {
        throw new Error(`"${item.name}" — недостаточно на складе. Обновите корзину`)
      }
    }

    // Deduct bonuses with real orderId (after order is created)
    if (bonusUsed > 0 && data.userId) {
      await deductBonusesInTx(tx, data.userId, created.id, bonusUsed)
    }

    return created
  })

  return order
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

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ["paid", "confirmed", "cancelled"],
  paid: ["pending", "confirmed", "cancelled"],
  confirmed: ["pending", "shipped", "cancelled"],
  shipped: ["confirmed", "delivered"],
  delivered: ["shipped"],
  payment_failed: ["pending", "cancelled"],
  cancelled: ["pending"],
}

export async function updateOrderStatus(id: string, status: string, changedBy?: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!order) throw new Error("Заказ не найден")

  const allowed = ALLOWED_TRANSITIONS[order.status] || []
  if (!allowed.includes(status)) {
    throw new Error(`Нельзя перевести заказ из "${order.status}" в "${status}"`)
  }

  const [updated] = await prisma.$transaction([
    prisma.order.update({
      where: { id },
      data: { status },
    }),
    prisma.orderStatusLog.create({
      data: {
        orderId: id,
        fromStatus: order.status,
        toStatus: status,
        changedBy: changedBy || null,
      },
    }),
  ])
  return updated
}

export { ALLOWED_TRANSITIONS }
