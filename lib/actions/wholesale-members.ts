"use server"

import crypto from "crypto"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireWholesale } from "@/lib/wholesale-guard"
import { dispatchEmail } from "@/lib/dal/email-dispatch"
import { sendRenderedEmail } from "@/lib/email"
import { checkRateLimit } from "@/lib/rate-limit"

const INVITE_TTL_DAYS = 7

/**
 * Только owner компании может приглашать сотрудников. buyer/accountant могут
 * смотреть список, но не менять.
 */
async function requireOwner() {
  const ctx = await requireWholesale()
  const user = await prisma.wholesaleUser.findUnique({
    where: { id: ctx.userId },
    select: { role: true },
  })
  if (!user || user.role !== "owner") {
    throw new Error("Только владелец аккаунта может управлять сотрудниками")
  }
  return ctx
}

export async function inviteWholesaleMember(input: {
  email: string
  name: string
  role: "buyer" | "accountant"
}) {
  const ctx = await requireOwner()

  const email = input.email.toLowerCase().trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Некорректный email")
  }
  if (!input.name.trim()) throw new Error("Укажите имя сотрудника")
  if (!["buyer", "accountant"].includes(input.role)) {
    throw new Error("Некорректная роль")
  }

  const rl = checkRateLimit(`wh-invite:${ctx.companyId}`, {
    windowMs: 60 * 60 * 1000,
    max: 20,
    blockMs: 60 * 60 * 1000,
  })
  if (!rl.allowed) throw new Error("Слишком много приглашений, попробуйте позже")

  // Если email уже активный юзер этой компании — ошибка
  const existingUser = await prisma.wholesaleUser.findUnique({ where: { email } })
  if (existingUser) {
    throw new Error("Пользователь с этим email уже существует")
  }

  // Активное приглашение по этому email в эту компанию → обновляем срок
  const existing = await prisma.wholesaleInvitation.findFirst({
    where: { email, companyId: ctx.companyId, usedAt: null, expiresAt: { gt: new Date() } },
  })
  const token = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400 * 1000)

  const inv = existing
    ? await prisma.wholesaleInvitation.update({
        where: { id: existing.id },
        data: { token, expiresAt, role: input.role, invitedById: ctx.userId },
      })
    : await prisma.wholesaleInvitation.create({
        data: {
          companyId: ctx.companyId,
          email,
          role: input.role,
          token,
          invitedById: ctx.userId,
          expiresAt,
        },
      })

  // Немедленно создаём placeholder WholesaleUser(status="pending", passwordHash=null)
  // чтобы в списке сотрудников он появился сразу. Активируется при accept.
  const placeholder = await prisma.wholesaleUser.upsert({
    where: { email },
    create: {
      email,
      name: input.name.trim(),
      companyId: ctx.companyId,
      role: input.role,
      status: "pending",
      passwordHash: null,
    },
    update: {
      // Если был существующий (не должен быть при текущей проверке, но на всякий
      // случай) — переводим в pending с ролью из инвайта
      name: input.name.trim(),
      role: input.role,
      status: "pending",
      companyId: ctx.companyId,
    },
  })

  const url = `${process.env.NEXTAUTH_URL || "https://millor-coffee.ru"}/wholesale/invite/${token}`
  const company = await prisma.wholesaleCompany.findUnique({
    where: { id: ctx.companyId },
    select: { legalName: true },
  })

  await dispatchEmail({
    orderId: null,
    kind: "wholesale.access_request.approved",
    recipient: email,
    render: () => ({
      subject: `Приглашение в оптовый кабинет Millor Coffee`,
      html: `
        <h2>Вас пригласили в оптовый кабинет</h2>
        <p>Здравствуйте, ${input.name}!</p>
        <p>Компания <strong>${company?.legalName ?? "Millor Coffee"}</strong> приглашает вас как <strong>${
          input.role === "accountant" ? "бухгалтера" : "закупщика"
        }</strong>.</p>
        <p><a href="${url}">Принять приглашение и установить пароль</a></p>
        <p>Ссылка действительна ${INVITE_TTL_DAYS} дней.</p>
      `,
    }),
    send: (e) => sendRenderedEmail(e),
  }).catch(() => {})

  revalidatePath("/wholesale/company/users")
  return { invitationId: inv.id, placeholderId: placeholder.id }
}

export async function revokeWholesaleInvitation(invitationId: string) {
  const ctx = await requireOwner()

  const inv = await prisma.wholesaleInvitation.findUnique({ where: { id: invitationId } })
  if (!inv) throw new Error("Приглашение не найдено")
  if (inv.companyId !== ctx.companyId) throw new Error("Нет доступа")
  if (inv.usedAt) throw new Error("Приглашение уже использовано")

  await prisma.$transaction(async (tx) => {
    await tx.wholesaleInvitation.delete({ where: { id: invitationId } })
    // Удаляем placeholder-юзера если он ещё pending и никто не активировал
    await tx.wholesaleUser.deleteMany({
      where: { email: inv.email, companyId: ctx.companyId, status: "pending" },
    })
  })

  revalidatePath("/wholesale/company/users")
}

export async function removeWholesaleMember(userId: string) {
  const ctx = await requireOwner()

  const user = await prisma.wholesaleUser.findUnique({ where: { id: userId } })
  if (!user) throw new Error("Пользователь не найден")
  if (user.companyId !== ctx.companyId) throw new Error("Нет доступа")
  if (user.id === ctx.userId) throw new Error("Нельзя удалить себя")
  if (user.role === "owner") throw new Error("Нельзя удалить владельца аккаунта")

  await prisma.wholesaleUser.update({
    where: { id: userId },
    data: { status: "blocked" },
  })

  revalidatePath("/wholesale/company/users")
}

export async function acceptWholesaleInvitation(input: {
  token: string
  password: string
  name?: string
}) {
  const password = input.password
  if (password.length < 8) throw new Error("Пароль должен быть не короче 8 символов")

  const inv = await prisma.wholesaleInvitation.findUnique({
    where: { token: input.token },
    include: { company: { select: { status: true } } },
  })
  if (!inv) throw new Error("Ссылка недействительна")
  if (inv.usedAt) throw new Error("Ссылка уже использована")
  if (inv.expiresAt < new Date()) throw new Error("Срок приглашения истёк")
  if (inv.company.status !== "active") throw new Error("Компания не активна")

  const passwordHash = await bcrypt.hash(password, 10)
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.wholesaleUser.update({
      where: { email: inv.email },
      data: {
        passwordHash,
        status: "active",
        emailVerified: now,
        name: input.name?.trim() || undefined,
      },
    })
    await tx.wholesaleInvitation.update({
      where: { id: inv.id },
      data: { usedAt: now },
    })
  })

  return { ok: true, email: inv.email }
}
