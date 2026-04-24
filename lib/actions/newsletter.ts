"use server"

import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { generateToken } from "@/lib/tokens"
import { recordConsent } from "@/lib/consent"

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase()
}

export interface SubscribeResult {
  ok: boolean
  error?: string
  alreadySubscribed?: boolean
}

/**
 * Подписка на рассылку. Публичный action — можно вызывать из footer-формы
 * и из checkout. Идемпотентен: повторный subscribe с тем же email не
 * создаёт дубликат (unique constraint), просто возвращает alreadySubscribed=true.
 *
 * Если юзер был unsubscribed, повторный subscribe реактивирует подписку
 * (status→active, ротирует unsubscribeToken).
 */
export async function subscribeToNewsletter(
  rawEmail: string,
  groups: string[] = ["promotions"],
  source: string = "footer_form"
): Promise<SubscribeResult> {
  const email = normalizeEmail(rawEmail)
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Некорректный email" }
  }

  const session = await auth()
  const userId =
    (session?.user as Record<string, unknown> | undefined)?.userType === "customer"
      ? session?.user?.id ?? null
      : null

  const h = await headers()
  const ipAddress = (h.get("x-forwarded-for") || "").split(",")[0]?.trim() || null
  const userAgent = h.get("user-agent") || null

  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } })

  if (existing) {
    if (existing.status === "active") {
      return { ok: true, alreadySubscribed: true }
    }
    // Реактивация: юзер отписывался, хочет вернуться.
    await prisma.newsletterSubscriber.update({
      where: { email },
      data: {
        status: "active",
        subscriptionGroups: groups,
        unsubscribedAt: null,
        bouncedAt: null,
        unsubscribeToken: generateToken(24),
        userId,
        ipAddress,
        userAgent,
      },
    })
  } else {
    await prisma.newsletterSubscriber.create({
      data: {
        email,
        status: "active",
        subscriptionGroups: groups,
        source,
        unsubscribeToken: generateToken(24),
        userId,
        ipAddress,
        userAgent,
      },
    })
  }

  // 152-ФЗ: подписка на маркетинг-рассылку — отдельное явное согласие.
  // Map source → ConsentSource enum (footer_form не в enum, маппим в settings).
  try {
    const consentSource: "checkout" | "register" | "settings" | "cookie_banner" =
      source === "checkout" || source === "register" || source === "cookie_banner"
        ? source
        : "settings"
    await recordConsent({
      userId,
      emailSnapshot: email,
      type: "marketing",
      source: consentSource,
    })
  } catch (e) {
    console.error("[newsletter] failed to record marketing consent:", e)
  }

  return { ok: true }
}

/**
 * One-click отписка из письма. Принимает unsubscribeToken. Не требует логина.
 */
export async function unsubscribeByToken(
  token: string
): Promise<{ ok: boolean; error?: string; email?: string }> {
  if (!token) return { ok: false, error: "Ссылка недействительна" }

  const sub = await prisma.newsletterSubscriber.findUnique({
    where: { unsubscribeToken: token },
  })
  if (!sub) return { ok: false, error: "Ссылка недействительна или уже использована" }

  if (sub.status !== "unsubscribed") {
    await prisma.newsletterSubscriber.update({
      where: { id: sub.id },
      data: {
        status: "unsubscribed",
        unsubscribedAt: new Date(),
        // Ротируем токен — ссылка станет одноразовой, повторное открытие
        // покажет generic-ошибку.
        unsubscribeToken: generateToken(24),
      },
    })

    // Revoke marketing-consent.
    if (sub.userId) {
      await prisma.userConsent.updateMany({
        where: { userId: sub.userId, type: "marketing", revokedAt: null },
        data: { revokedAt: new Date() },
      })
    }
  }

  return { ok: true, email: sub.email }
}
