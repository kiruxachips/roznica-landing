"use server"

import crypto from "crypto"
import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"
import { createAccessRequest } from "@/lib/dal/wholesale-requests"
import { dispatchEmail } from "@/lib/dal/email-dispatch"
import { sendRenderedEmail } from "@/lib/email"
import { enqueueOutbox } from "@/lib/dal/outbox"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

async function getIp(): Promise<string> {
  const h = await headers()
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown"
}

export async function submitWholesaleAccessRequest(input: {
  legalName: string
  inn: string
  contactName: string
  contactPhone: string
  contactEmail: string
  expectedVolume?: string
  comment?: string
}) {
  const ip = await getIp()
  const hdrs = await headers()
  const userAgent = hdrs.get("user-agent") ?? null

  // Rate limit — защита от спама заявок с одного IP/email
  const email = input.contactEmail.toLowerCase().trim()
  const rlKey = `wholesale-request:${email}:${ip}`
  const rl = checkRateLimit(rlKey, { windowMs: 60 * 60 * 1000, max: 3, blockMs: 60 * 60 * 1000 })
  if (!rl.allowed) {
    throw new Error("Слишком много заявок с одного адреса. Попробуйте через час.")
  }

  const req = await createAccessRequest({
    legalName: input.legalName,
    inn: input.inn,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    contactEmail: email,
    expectedVolume: input.expectedVolume ?? null,
    comment: input.comment ?? null,
    ipAddress: ip,
    userAgent,
  })

  // Email заявителю — подтверждение получения
  await dispatchEmail({
    orderId: null,
    kind: "wholesale.access_request.submitted",
    recipient: email,
    render: () => ({
      subject: "Заявка на оптовый доступ принята",
      html: `
        <h2>Ваша заявка на оптовый кабинет Millor Coffee принята</h2>
        <p>Здравствуйте, ${input.contactName}!</p>
        <p>Мы получили вашу заявку на доступ к оптовому кабинету.</p>
        <p><strong>Компания:</strong> ${input.legalName}<br/>
           <strong>ИНН:</strong> ${req.inn}</p>
        <p>Наш менеджер свяжется с вами в ближайшие рабочие часы для проверки и активации доступа.</p>
        <p>С уважением,<br/>команда Millor Coffee</p>
      `,
    }),
    send: (email) => sendRenderedEmail(email),
  }).catch(() => {})

  // Event в Millorbot — новая заявка от оптовика
  await enqueueOutbox(
    "wholesale.access_request.created",
    {
      event_id: `wa_req_${req.id}`,
      event: "wholesale.access_request.created",
      occurred_at: new Date().toISOString(),
      request: {
        id: req.id,
        legalName: req.legalName,
        inn: req.inn,
        contactName: req.contactName,
        contactPhone: req.contactPhone,
        contactEmail: req.contactEmail,
        expectedVolume: req.expectedVolume,
        comment: req.comment,
        admin_url: `/admin/wholesale/requests/${req.id}`,
      },
    },
    { eventId: `wa_req_${req.id}` }
  ).catch(() => {})

  revalidatePath("/admin/wholesale/requests")
  return { id: req.id }
}

/**
 * Генерация криптостойкого временного пароля (12 символов, alphanum без
 * похожих символов I/l/O/0 — чтобы клиент не ошибся при перепечатке).
 */
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  const bytes = crypto.randomBytes(12)
  return Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join("")
}

export async function approveWholesaleAccessRequest(
  requestId: string,
  input: {
    priceListId: string | null
    paymentTerms: "prepay" | "net7" | "net14" | "net30" | "net60"
    creditLimit: number
    managerAdminId: string | null
  }
) {
  const admin = await requireAdmin("wholesale.requests.approve")

  const req = await prisma.wholesaleAccessRequest.findUnique({ where: { id: requestId } })
  if (!req) throw new Error("Заявка не найдена")
  if (req.status !== "pending") throw new Error("Заявка уже обработана")

  // Предварительно проверяем что ИНН не занят и email не уже активный wholesale-юзер
  const existingCompany = await prisma.wholesaleCompany.findUnique({ where: { inn: req.inn } })
  if (existingCompany) throw new Error("Компания с таким ИНН уже зарегистрирована")
  const existingUser = await prisma.wholesaleUser.findUnique({ where: { email: req.contactEmail } })
  if (existingUser) throw new Error("Пользователь с таким email уже существует в оптовом кабинете")

  const tempPassword = generateTempPassword()
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  const { company, user } = await prisma.$transaction(async (tx) => {
    const company = await tx.wholesaleCompany.create({
      data: {
        legalName: req.legalName,
        inn: req.inn,
        contactName: req.contactName,
        contactPhone: req.contactPhone,
        contactEmail: req.contactEmail,
        status: "active",
        paymentTerms: input.paymentTerms,
        creditLimit: input.creditLimit,
        priceListId: input.priceListId,
        managerAdminId: input.managerAdminId,
        approvedById: admin.userId,
        approvedAt: new Date(),
      },
    })
    const user = await tx.wholesaleUser.create({
      data: {
        email: req.contactEmail,
        emailVerified: new Date(),
        passwordHash,
        name: req.contactName,
        phone: req.contactPhone,
        role: "owner",
        status: "active",
        companyId: company.id,
      },
    })
    await tx.wholesaleAccessRequest.update({
      where: { id: requestId },
      data: {
        status: "approved",
        reviewedById: admin.userId,
        reviewedAt: new Date(),
        companyId: company.id,
      },
    })
    return { company, user }
  })

  void logAdminAction({
    admin,
    action: "wholesale.request.approved",
    entityType: "wholesale_access_request",
    entityId: requestId,
    payload: { companyId: company.id, inn: company.inn, legalName: company.legalName },
  })

  // Email клиенту — доступ открыт, временный пароль
  const nextAuthUrl = process.env.NEXTAUTH_URL || "https://millor-coffee.ru"
  await dispatchEmail({
    orderId: null,
    kind: "wholesale.access_request.approved",
    recipient: user.email,
    render: () => ({
      subject: "Оптовый кабинет Millor Coffee открыт",
      html: `
        <h2>Ваш оптовый кабинет активирован</h2>
        <p>Здравствуйте, ${user.name}!</p>
        <p>Заявка по компании <strong>${company.legalName}</strong> одобрена.</p>
        <p><strong>Логин:</strong> ${user.email}<br/>
           <strong>Временный пароль:</strong> <code>${tempPassword}</code></p>
        <p><a href="${nextAuthUrl}/wholesale/login">Войти в кабинет</a></p>
        <p>После входа рекомендуем сменить пароль в разделе профиля.</p>
        <p>С уважением,<br/>команда Millor Coffee</p>
      `,
    }),
    send: (email) => sendRenderedEmail(email),
  }).catch(() => {})

  await enqueueOutbox(
    "wholesale.access_request.approved",
    {
      event_id: `wa_req_approved_${requestId}`,
      event: "wholesale.access_request.approved",
      occurred_at: new Date().toISOString(),
      request: { id: requestId, companyId: company.id, legalName: company.legalName, inn: company.inn },
    },
    { eventId: `wa_req_approved_${requestId}` }
  ).catch(() => {})

  revalidatePath("/admin/wholesale/requests")
  revalidatePath("/admin/wholesale/companies")
  return { companyId: company.id, userId: user.id }
}

export async function rejectWholesaleAccessRequest(requestId: string, note: string) {
  const admin = await requireAdmin("wholesale.requests.approve")

  const req = await prisma.wholesaleAccessRequest.findUnique({ where: { id: requestId } })
  if (!req) throw new Error("Заявка не найдена")
  if (req.status !== "pending") throw new Error("Заявка уже обработана")

  await prisma.wholesaleAccessRequest.update({
    where: { id: requestId },
    data: {
      status: "rejected",
      reviewedById: admin.userId,
      reviewedAt: new Date(),
      reviewerNote: note,
    },
  })

  void logAdminAction({
    admin,
    action: "wholesale.request.rejected",
    entityType: "wholesale_access_request",
    entityId: requestId,
    payload: { note },
  })

  await dispatchEmail({
    orderId: null,
    kind: "wholesale.access_request.rejected",
    recipient: req.contactEmail,
    render: () => ({
      subject: "Заявка на оптовый доступ Millor Coffee",
      html: `
        <h2>Заявка отклонена</h2>
        <p>Здравствуйте, ${req.contactName}.</p>
        <p>К сожалению, ваша заявка на оптовый кабинет отклонена.</p>
        ${note ? `<p><strong>Комментарий:</strong> ${note}</p>` : ""}
        <p>Если считаете это ошибкой — ответьте на это письмо или свяжитесь с нами напрямую.</p>
      `,
    }),
    send: (email) => sendRenderedEmail(email),
  }).catch(() => {})

  revalidatePath("/admin/wholesale/requests")
}
