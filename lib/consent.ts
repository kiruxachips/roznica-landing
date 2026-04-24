import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"

/**
 * Версии текстов документов. При изменении текста `/privacy` или `/terms`
 * — инкрементим соответствующий ключ. Тогда у пользователей с согласием
 * на старую версию можно запросить re-consent.
 *
 * Как синхронизировать:
 *   - изменили `/privacy/page.tsx` → PRIVACY.version + 1
 *   - изменили чекбокс на чекауте → CHECKOUT.version + 1
 *
 * Версию пишем в UserConsent.version при записи.
 */
export const CONSENT_VERSIONS = {
  privacy: 1,
  marketing: 1,
  cookies: 1,
  checkout: 1,
} as const

export type ConsentType = "privacy" | "marketing" | "cookies"
export type ConsentSource = "checkout" | "register" | "settings" | "cookie_banner"

interface RecordConsentInput {
  userId?: string | null
  emailSnapshot?: string | null
  type: ConsentType
  source: ConsentSource
  orderId?: string | null
}

/**
 * Сохраняет согласие в БД с IP и User-Agent из текущего HTTP-запроса.
 * Вызывать только из server actions или route handlers — использует `headers()`.
 *
 * Если тот же юзер уже дал consent этого типа и version актуальна — не
 * создаём дубликат (идемпотентно).
 */
export async function recordConsent(input: RecordConsentInput): Promise<void> {
  const h = await headers()
  // X-Forwarded-For приходит от nginx/cloudflare. Берём первый IP
  // (client), не последний (proxy). Может быть null если заголовок пустой.
  const forwardedFor = h.get("x-forwarded-for") || ""
  const ipAddress = forwardedFor.split(",")[0]?.trim() || h.get("x-real-ip") || null
  const userAgent = h.get("user-agent") || null

  const version = CONSENT_VERSIONS[input.type]

  // Idempotency: если уже есть активный consent с актуальной версией —
  // не дублируем. Но если version новее — создаём новую запись (re-consent).
  if (input.userId) {
    const existing = await prisma.userConsent.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        revokedAt: null,
        version: { gte: version },
      },
    })
    if (existing) return
  }

  await prisma.userConsent.create({
    data: {
      userId: input.userId ?? null,
      emailSnapshot: input.emailSnapshot ?? null,
      type: input.type,
      version,
      source: input.source,
      orderId: input.orderId ?? null,
      ipAddress,
      userAgent,
    },
  })
}

export async function revokeConsent(userId: string, type: ConsentType): Promise<void> {
  await prisma.userConsent.updateMany({
    where: { userId, type, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}
