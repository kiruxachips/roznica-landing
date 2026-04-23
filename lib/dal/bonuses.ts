import { prisma } from "@/lib/prisma"
import { getDeliverySettings } from "./delivery-settings"

export async function getBonusBalance(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bonusBalance: true },
  })
  return user?.bonusBalance ?? 0
}

export async function getBonusTransactions(
  userId: string,
  { page = 1, limit = 20 } = {}
) {
  const [transactions, total] = await Promise.all([
    prisma.bonusTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.bonusTransaction.count({ where: { userId } }),
  ])

  return { transactions, total }
}

async function getBonusRate(): Promise<number> {
  const settings = await getDeliverySettings()
  return parseFloat(settings.bonus_rate || "5") / 100
}

export async function creditBonusesForOrder(
  userId: string,
  orderId: string,
  orderTotal: number
) {
  const rate = await getBonusRate()
  const earned = Math.floor(orderTotal * rate)
  if (earned <= 0) return

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { bonusBalance: { increment: earned } },
    }),
    prisma.bonusTransaction.create({
      data: {
        userId,
        amount: earned,
        type: "earned",
        description: `Начислено за заказ`,
        orderId,
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { bonusEarned: earned },
    }),
  ])

  return earned
}

/**
 * Списывает ранее начисленные за заказ бонусы. Используется при отмене
 * уже доставленного заказа (P1-14): иначе покупатель получает бонусы за
 * товар, которого у него фактически нет.
 *
 * Идемпотентно: сбрасывает Order.bonusEarned в 0, поэтому повторный вызов
 * ничего не сделает.
 *
 * Если у юзера не хватает баланса (уже потратил бонусы), уводим в минус —
 * это предпочтительно блокировке cancel-а: администратор должен иметь
 * возможность аннулировать заказ при любых обстоятельствах, а отрицательный
 * баланс восстановится из следующих начислений.
 */
export async function reverseOrderEarnedBonuses(userId: string, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { bonusEarned: true },
  })
  if (!order || order.bonusEarned <= 0) return 0

  const amount = order.bonusEarned
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { bonusBalance: { decrement: amount } },
    }),
    prisma.bonusTransaction.create({
      data: {
        userId,
        amount: -amount,
        type: "admin_adjustment",
        description: `Возврат бонусов — отмена доставленного заказа`,
        orderId,
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { bonusEarned: 0 },
    }),
  ])
  return amount
}

export async function deductBonusesInTx(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
  orderId: string,
  amount: number
) {
  if (amount <= 0) return

  // Atomic deduction — prevents negative balance from concurrent orders
  const affected = await tx.$executeRaw`
    UPDATE "User"
    SET "bonusBalance" = "bonusBalance" - ${amount}
    WHERE id = ${userId} AND "bonusBalance" >= ${amount}
  `
  if (affected === 0) {
    throw new Error("Недостаточно бонусов. Обновите страницу")
  }

  await tx.bonusTransaction.create({
    data: {
      userId,
      amount: -amount,
      type: "spent",
      description: `Списано при оплате заказа`,
      orderId,
    },
  })
}
