import { prisma } from "@/lib/prisma"
import { getDeliverySettings } from "@/lib/dal/delivery-settings"

export interface WelcomeDiscountConfig {
  enabled: boolean
  percent: number
  maxRub: number // cap ₽ (e.g. скидка не больше 500 даже если 10% = 800)
}

export async function getWelcomeDiscountConfig(): Promise<WelcomeDiscountConfig> {
  const s = await getDeliverySettings()
  return {
    enabled: s.welcome_discount_enabled === "true",
    percent: Math.max(0, Math.min(50, parseInt(s.welcome_discount_percent || "10", 10) || 0)),
    maxRub: Math.max(0, parseInt(s.welcome_discount_max || "500", 10) || 0),
  }
}

/**
 * Проверяет имеет ли юзер право на welcome-скидку.
 * Гость (userId=undefined) → true (скидка для первой покупки стимулирует
 * регистрацию; гость может оформить без аккаунта, но чтобы вернуться за
 * скидкой на 2-й — должен войти).
 * Зарегистрированный → firstOrderCompletedAt === null.
 */
export async function isEligibleForWelcomeDiscount(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return true
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstOrderCompletedAt: true, deletedAt: true },
  })
  if (!user) return false
  if (user.deletedAt) return false
  return user.firstOrderCompletedAt === null
}

/**
 * Считает welcome-скидку для данного subtotal. Возвращает 0 если welcome
 * отключён, юзер не имеет права, или subtotal нулевой. Уже учитывает cap.
 */
export function computeWelcomeDiscount(
  subtotal: number,
  config: WelcomeDiscountConfig
): number {
  if (!config.enabled || subtotal <= 0 || config.percent === 0) return 0
  const raw = Math.floor((subtotal * config.percent) / 100)
  return Math.min(raw, config.maxRub)
}
