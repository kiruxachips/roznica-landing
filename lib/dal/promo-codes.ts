import { prisma } from "@/lib/prisma"

export async function validatePromoCode(code: string, subtotal: number, userId?: string) {
  const promo = await prisma.promoCode.findUnique({
    where: { code: code.toUpperCase() },
  })

  if (!promo) {
    return { valid: false, error: "Промокод не найден" }
  }

  if (!promo.isActive) {
    return { valid: false, error: "Промокод неактивен" }
  }

  const now = new Date()
  if (now < promo.startDate) {
    return { valid: false, error: "Промокод ещё не действует" }
  }
  if (now > promo.endDate) {
    return { valid: false, error: "Срок действия промокода истёк" }
  }

  if (promo.maxUsage !== null && promo.usageCount >= promo.maxUsage) {
    return { valid: false, error: "Промокод исчерпан" }
  }

  if (promo.maxPerCustomer !== null && userId) {
    const customerUsage = await prisma.order.count({
      where: { promoCodeId: promo.id, userId, status: { not: "cancelled" } },
    })
    if (customerUsage >= promo.maxPerCustomer) {
      return { valid: false, error: "Вы уже использовали этот промокод максимальное количество раз" }
    }
  }

  if (promo.minOrderSum !== null && subtotal < promo.minOrderSum) {
    return { valid: false, error: `Минимальная сумма заказа ${promo.minOrderSum}₽` }
  }

  let discount: number
  if (promo.type === "percent") {
    discount = Math.round(subtotal * promo.value / 100)
  } else {
    discount = Math.min(promo.value, subtotal)
  }

  return {
    valid: true,
    promo,
    discount,
  }
}

export async function getPromoCodes({ page = 1, limit = 20 } = {}) {
  const [promoCodes, total] = await Promise.all([
    prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.promoCode.count(),
  ])

  return { promoCodes, total }
}

export async function getPromoCodeById(id: string) {
  return prisma.promoCode.findUnique({ where: { id } })
}
