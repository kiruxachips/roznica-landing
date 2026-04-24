"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"

/**
 * Ручная корректировка бонусного баланса клиента админом.
 * Пишем BonusTransaction с типом "admin_adjustment" + idempotencyKey
 * на случай повторной отправки формы.
 *
 * positive amount = начислить, negative = списать.
 */
export async function adjustCustomerBonuses(
  userId: string,
  amount: number,
  reason: string
): Promise<{ ok: boolean; error?: string; newBalance?: number }> {
  const admin = await requireAdmin("customers.edit")

  if (!Number.isFinite(amount) || amount === 0) {
    return { ok: false, error: "Укажите сумму не равную нулю" }
  }
  if (!reason.trim()) {
    return { ok: false, error: "Укажите причину изменения" }
  }
  if (amount < -1_000_000 || amount > 1_000_000) {
    return { ok: false, error: "Сумма вне допустимого диапазона" }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bonusBalance: true, email: true, deletedAt: true },
  })
  if (!user) return { ok: false, error: "Клиент не найден" }
  if (user.deletedAt) return { ok: false, error: "Клиент удалил аккаунт" }

  const newBalance = user.bonusBalance + amount
  if (newBalance < 0) {
    return { ok: false, error: `Баланс станет отрицательным (${newBalance}₽). Нельзя.` }
  }

  // Idempotency: не позволяем тот же admin сделать ту же операцию повторно
  // в течение 30 секунд (защита от случайного double-submit формы).
  const key = `admin-adjust:${admin.userId}:${userId}:${amount}:${Math.floor(Date.now() / 30_000)}`

  try {
    await prisma.$transaction(async (tx) => {
      await tx.bonusTransaction.create({
        data: {
          userId,
          amount,
          type: "admin_adjustment",
          description: reason,
          idempotencyKey: key,
        },
      })
      await tx.user.update({
        where: { id: userId },
        data: { bonusBalance: { increment: amount } },
      })
    })
  } catch (e) {
    // P2002 на idempotencyKey — дубль, silently игнорим.
    if (typeof e === "object" && e && (e as { code?: string }).code === "P2002") {
      return { ok: true, newBalance }
    }
    throw e
  }

  void logAdminAction({
    admin,
    action: "customer.bonus_adjusted",
    entityType: "user",
    entityId: userId,
    payload: { amount, reason, newBalance },
  })

  revalidatePath(`/admin/customers/${userId}`)
  return { ok: true, newBalance }
}
