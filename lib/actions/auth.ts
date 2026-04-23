"use server"

import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { sendVerificationCode, sendPasswordResetCode } from "@/lib/email"

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Нормализация email для БД-lookup. Postgres text case-sensitive,
 * поэтому все точки работы с email должны гонять его через одну функцию:
 * регистрация, resend code, verify, password reset, login. См. также
 * lib/auth.ts — там customer credentials тоже нормализует.
 */
function normalizeEmail(raw: string): string {
  return raw.toLowerCase().trim()
}

export async function registerUser({
  email: rawEmail,
  password,
  name,
}: {
  email: string
  password: string
  name: string
}) {
  const email = normalizeEmail(rawEmail)
  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing?.emailVerified) {
    return { error: "Пользователь с таким email уже зарегистрирован" }
  }

  const passwordHash = await bcrypt.hash(password, 10)

  // Create or update unverified user
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { passwordHash, name },
    })
  } else {
    await prisma.user.create({
      data: { email, passwordHash, name },
    })
  }

  // Rate limit: max 3 codes per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentCodes = await prisma.verificationCode.count({
    where: { email, type: "email_verify", createdAt: { gte: oneHourAgo } },
  })
  if (recentCodes >= 3) {
    return { error: "Слишком много попыток. Попробуйте через час." }
  }

  const code = generateCode()
  await prisma.verificationCode.create({
    data: {
      email,
      code,
      type: "email_verify",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  })

  await sendVerificationCode(email, code)

  return { success: true }
}

export async function verifyEmailCode(rawEmail: string, code: string) {
  const email = normalizeEmail(rawEmail)
  const verification = await prisma.verificationCode.findFirst({
    where: {
      email,
      type: "email_verify",
      used: false,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })

  if (!verification) {
    return { error: "Код истёк или не найден. Запросите новый." }
  }

  if (verification.attempts >= 5) {
    return { error: "Превышено количество попыток. Запросите новый код." }
  }

  if (verification.code !== code) {
    await prisma.verificationCode.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    })
    return { error: "Неверный код" }
  }

  // Mark code as used
  await prisma.verificationCode.update({
    where: { id: verification.id },
    data: { used: true },
  })

  // Verify user email
  const user = await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  })

  // Link guest orders
  await linkGuestOrders(user.id, email, user.phone)

  return { success: true, userId: user.id }
}

export async function resendVerificationCode(rawEmail: string) {
  const email = normalizeEmail(rawEmail)
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return { error: "Пользователь не найден" }
  }
  if (user.emailVerified) {
    return { error: "Email уже подтверждён" }
  }

  // Rate limit
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentCodes = await prisma.verificationCode.count({
    where: { email, type: "email_verify", createdAt: { gte: oneHourAgo } },
  })
  if (recentCodes >= 3) {
    return { error: "Слишком много попыток. Попробуйте через час." }
  }

  const code = generateCode()
  await prisma.verificationCode.create({
    data: {
      email,
      code,
      type: "email_verify",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  })

  await sendVerificationCode(email, code)

  return { success: true }
}

export async function requestPasswordReset(rawEmail: string) {
  const email = normalizeEmail(rawEmail)
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.emailVerified) {
    // Don't reveal if user exists
    return { success: true }
  }

  // Rate limit
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentCodes = await prisma.verificationCode.count({
    where: { email, type: "password_reset", createdAt: { gte: oneHourAgo } },
  })
  if (recentCodes >= 3) {
    return { success: true }
  }

  const code = generateCode()
  await prisma.verificationCode.create({
    data: {
      email,
      code,
      type: "password_reset",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  })

  await sendPasswordResetCode(email, code)

  return { success: true }
}

export async function resetPassword(rawEmail: string, code: string, newPassword: string) {
  const email = normalizeEmail(rawEmail)
  const verification = await prisma.verificationCode.findFirst({
    where: {
      email,
      type: "password_reset",
      used: false,
      expiresAt: { gte: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })

  if (!verification) {
    return { error: "Код истёк или не найден" }
  }

  if (verification.attempts >= 5) {
    return { error: "Превышено количество попыток" }
  }

  if (verification.code !== code) {
    await prisma.verificationCode.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    })
    return { error: "Неверный код" }
  }

  await prisma.verificationCode.update({
    where: { id: verification.id },
    data: { used: true },
  })

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { email },
    data: { passwordHash },
  })

  return { success: true }
}

async function linkGuestOrders(userId: string, email: string | null, phone: string | null) {
  if (!email && !phone) return

  const where = []
  if (email) where.push({ customerEmail: email })
  if (phone) where.push({ customerPhone: phone })

  await prisma.order.updateMany({
    where: {
      userId: null,
      OR: where,
    },
    data: { userId },
  })
}
