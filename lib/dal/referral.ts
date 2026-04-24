import { prisma } from "@/lib/prisma"
import { getDeliverySettings } from "@/lib/dal/delivery-settings"
import type { Prisma } from "@prisma/client"

export interface ReferralConfig {
  enabled: boolean
  inviterBonus: number
  inviteeBonus: number
}

export async function getReferralConfig(): Promise<ReferralConfig> {
  const s = await getDeliverySettings()
  return {
    enabled: s.referral_enabled === "true",
    inviterBonus: Math.max(0, parseInt(s.referral_inviter_bonus || "500", 10) || 0),
    inviteeBonus: Math.max(0, parseInt(s.referral_invitee_bonus || "200", 10) || 0),
  }
}

/**
 * Генерирует короткий human-readable код: «MILLOR-XYZ4». Коллизии
 * проверяются запросом; при P2002 — пробуем ещё раз с новым random.
 */
export async function getOrCreateReferralCodeForUser(userId: string): Promise<string> {
  const existing = await prisma.referralCode.findUnique({
    where: { userId },
    select: { code: true },
  })
  if (existing) return existing.code

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  })

  // Берём первую латинскую часть имени (если есть) для дружелюбности,
  // иначе — префикс "MC".
  const firstLatin = (user?.name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 6)
    .toUpperCase()
  const prefix = firstLatin.length >= 3 ? firstLatin : "MC"

  // Пытаемся до 5 раз — практически невозможно столкнуться.
  for (let i = 0; i < 5; i++) {
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
    const code = `${prefix}-${suffix}`
    try {
      await prisma.referralCode.create({ data: { userId, code } })
      return code
    } catch (e) {
      if ((e as { code?: string })?.code === "P2002") continue
      throw e
    }
  }
  throw new Error("Не удалось сгенерировать реферальный код — попробуйте ещё раз")
}

/**
 * Находит ReferralCode по коду. Case-insensitive (юзеры копируют коды
 * небрежно) — код в БД в upper-case, мы приводим вход тоже в upper.
 */
export async function findActiveReferralCode(code: string) {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  const entry = await prisma.referralCode.findUnique({
    where: { code: normalized },
    select: {
      id: true,
      userId: true,
      code: true,
      expiresAt: true,
    },
  })
  if (!entry) return null
  if (entry.expiresAt && entry.expiresAt < new Date()) return null
  return entry
}

/**
 * Вызывается ОДИН раз при первом оплаченном заказе нового юзера.
 * Создаёт ReferralRedemption + BonusTransaction обоим + инкрементит
 * ReferralCode.usageCount. Идемпотентно через unique(orderId).
 */
export async function applyReferralReward(
  tx: Prisma.TransactionClient,
  params: {
    referralCodeId: string
    inviterUserId: string
    referredUserId: string
    orderId: string
    inviterBonus: number
    inviteeBonus: number
  }
): Promise<void> {
  // Если уже создана — идемпотентно пропускаем.
  const existing = await tx.referralRedemption.findUnique({
    where: { orderId: params.orderId },
  })
  if (existing) return

  await tx.referralRedemption.create({
    data: {
      referralCodeId: params.referralCodeId,
      referredUserId: params.referredUserId,
      orderId: params.orderId,
      referrerReward: params.inviterBonus,
      referredReward: params.inviteeBonus,
    },
  })

  // Inviter
  if (params.inviterBonus > 0) {
    await tx.bonusTransaction.create({
      data: {
        userId: params.inviterUserId,
        amount: params.inviterBonus,
        type: "earned",
        description: `Реферальный бонус за друга (${params.orderId.slice(-6)})`,
        orderId: params.orderId,
        idempotencyKey: `referral:inviter:${params.orderId}`,
      },
    })
    await tx.user.update({
      where: { id: params.inviterUserId },
      data: { bonusBalance: { increment: params.inviterBonus } },
    })
  }

  // Invitee
  if (params.inviteeBonus > 0) {
    await tx.bonusTransaction.create({
      data: {
        userId: params.referredUserId,
        amount: params.inviteeBonus,
        type: "earned",
        description: `Приветственный реферальный бонус`,
        orderId: params.orderId,
        idempotencyKey: `referral:invitee:${params.orderId}`,
      },
    })
    await tx.user.update({
      where: { id: params.referredUserId },
      data: { bonusBalance: { increment: params.inviteeBonus } },
    })
  }

  await tx.referralCode.update({
    where: { id: params.referralCodeId },
    data: {
      usageCount: { increment: 1 },
      totalRewardEarned: { increment: params.inviterBonus },
    },
  })
}
