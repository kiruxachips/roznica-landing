import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import type { OrderData } from "@/lib/types"
import { validatePromoCode } from "@/lib/dal/promo-codes"
import { deductBonusesInTx } from "@/lib/dal/bonuses"

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
  const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  let discount = 0
  let promoCodeId: string | null = null

  if (data.promoCode) {
    const result = await validatePromoCode(data.promoCode, subtotal)
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

  const deliveryPrice = (afterDiscount - bonusUsed) >= 3000 ? 0 : (afterDiscount >= 3000 ? 0 : 300)
  const total = afterDiscount - bonusUsed + deliveryPrice

  const order = await prisma.$transaction(async (tx) => {
    if (promoCodeId) {
      await tx.promoCode.update({
        where: { id: promoCodeId },
        data: { usageCount: { increment: 1 } },
      })
    }

    // Deduct bonuses
    if (bonusUsed > 0 && data.userId) {
      await deductBonusesInTx(tx, data.userId, "", bonusUsed)
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

    // Update bonus transaction with actual orderId
    if (bonusUsed > 0 && data.userId) {
      await tx.bonusTransaction.updateMany({
        where: { userId: data.userId, orderId: "", type: "spent" },
        data: { orderId: created.id },
      })
    }

    return created
  })

  return order
}

export async function getOrders(filters: { status?: string; page?: number; limit?: number } = {}) {
  const { status, page = 1, limit = 20 } = filters
  const where = status ? { status } : {}

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

export async function updateOrderStatus(id: string, status: string) {
  return prisma.order.update({
    where: { id },
    data: { status },
  })
}
