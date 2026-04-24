"use server"

import crypto from "crypto"
import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import { dispatchEmail } from "@/lib/dal/email-dispatch"
import { sendRenderedEmail } from "@/lib/email"
import { checkRateLimit } from "@/lib/rate-limit"

const RESET_KIND = "wholesale_password_reset"

export async function requestWholesalePasswordReset(email: string) {
  const normalized = email.toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Некорректный email")
  }

  const hdrs = await headers()
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || "unknown"
  const rl = checkRateLimit(`wh-reset:${normalized}:${ip}`, {
    windowMs: 60 * 60 * 1000,
    max: 3,
    blockMs: 60 * 60 * 1000,
  })
  if (!rl.allowed) throw new Error("Слишком много запросов. Попробуйте через час.")

  const user = await prisma.wholesaleUser.findUnique({ where: { email: normalized } })
  // Независимо от факта существования — возвращаем success. Защита от enumeration.
  if (!user) return { ok: true }

  const code = String(crypto.randomInt(100000, 999999))
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

  await prisma.verificationCode.create({
    data: {
      email: normalized,
      code,
      type: RESET_KIND,
      expiresAt,
    },
  })

  await dispatchEmail({
    orderId: null,
    kind: "wholesale.password_reset",
    recipient: normalized,
    render: () => ({
      subject: "Код для сброса пароля — оптовый кабинет Millor Coffee",
      html: `
        <h2>Код для сброса пароля</h2>
        <p>Здравствуйте, ${user.name}!</p>
        <p>Ваш код: <strong style="font-size: 24px; letter-spacing: 4px;">${code}</strong></p>
        <p>Код действителен 15 минут. Если вы не запрашивали сброс — игнорируйте это письмо.</p>
      `,
    }),
    send: (e) => sendRenderedEmail(e),
  })

  return { ok: true }
}

export async function confirmWholesalePasswordReset(input: {
  email: string
  code: string
  newPassword: string
}) {
  const email = input.email.toLowerCase().trim()
  const code = input.code.trim()
  const password = input.newPassword

  if (password.length < 8) throw new Error("Пароль должен быть не короче 8 символов")

  const record = await prisma.verificationCode.findFirst({
    where: {
      email,
      code,
      type: RESET_KIND,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })
  if (!record) throw new Error("Неверный или истёкший код")

  const user = await prisma.wholesaleUser.findUnique({ where: { email } })
  if (!user) throw new Error("Пользователь не найден")

  const passwordHash = await bcrypt.hash(password, 10)

  await prisma.$transaction(async (tx) => {
    await tx.verificationCode.update({ where: { id: record.id }, data: { used: true } })
    await tx.wholesaleUser.update({
      where: { id: user.id },
      data: { passwordHash, emailVerified: user.emailVerified ?? new Date() },
    })
  })

  return { ok: true }
}
