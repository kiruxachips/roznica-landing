"use server"

import bcrypt from "bcryptjs"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireWholesale } from "@/lib/wholesale-guard"
import { dispatchEmail } from "@/lib/dal/email-dispatch"
import { sendRenderedEmail, getWholesaleNotificationEmails } from "@/lib/email"
import { enqueueOutbox } from "@/lib/dal/outbox"
import { checkRateLimit } from "@/lib/rate-limit"
import { findPartyByInn } from "@/lib/integrations/dadata"
import type { Prisma } from "@prisma/client"

/**
 * Самостоятельная регистрация оптовика — никаких заявок и согласований.
 * После submit:
 *   - Company создаётся с status="active", привязана к default weight-tier прайс-листу.
 *     Tier-скидки по весу работают сразу (6кг=3%, 15кг=5%, 30кг=9%, 60кг=20%).
 *   - paymentTerms="prepay", creditLimit=0 — стандартный режим.
 *   - User сразу active, auto-login в RegisterForm.
 *   - Если позже хочет отсрочку/счёт УПД — заполняет ИНН/реквизиты
 *     на /wholesale/company/info, менеджер одобряет и выставляет лимит.
 */
async function getDefaultPriceListId(): Promise<string | null> {
  const defaultId = process.env.DEFAULT_WHOLESALE_PRICE_LIST_ID
  if (defaultId) {
    const exists = await prisma.priceList.findFirst({
      where: { id: defaultId, isActive: true, kind: "weight_tier" },
      select: { id: true },
    })
    if (exists) return exists.id
  }
  // Фолбэк: первый активный weight-tier прайс-лист
  const first = await prisma.priceList.findFirst({
    where: { isActive: true, kind: "weight_tier" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  return first?.id ?? null
}

function emailValid(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
}
function phoneValid(p: string) {
  const d = p.replace(/\D/g, "")
  return d.length === 11 && (d[0] === "7" || d[0] === "8")
}

export async function signupWholesaleSelfService(input: {
  email: string
  password: string
  name: string
  phone: string
  companyName?: string
}) {
  const hdrs = await headers()
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || "unknown"

  const email = input.email.toLowerCase().trim()
  if (!emailValid(email)) throw new Error("Некорректный email")
  if (input.password.length < 8) throw new Error("Пароль должен быть не короче 8 символов")
  if (!input.name.trim()) throw new Error("Укажите имя")
  if (!phoneValid(input.phone)) throw new Error("Некорректный телефон")

  // Rate limit — защита от спама
  const rl = checkRateLimit(`wh-signup:${ip}`, {
    windowMs: 60 * 60 * 1000,
    max: 3,
    blockMs: 60 * 60 * 1000,
  })
  if (!rl.allowed) throw new Error("Слишком много регистраций с этого IP. Попробуйте через час.")

  // Email занят?
  const existing = await prisma.wholesaleUser.findUnique({ where: { email } })
  if (existing) throw new Error("Email уже используется. Войдите или восстановите пароль.")

  // Создаём «карантинную» компанию с временным ИНН-placeholder.
  // ИНН реально будет заполнен на шаге 2 (wholesale-company-info.ts).
  // Для уникальности временный ИНН = random. Его не видно пользователю.
  const passwordHash = await bcrypt.hash(input.password, 10)
  const placeholderInn = `TMP${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`

  const companyName = input.companyName?.trim() || `Новый оптовый клиент (${email})`
  const defaultPriceListId = await getDefaultPriceListId()

  const { company, user } = await prisma.$transaction(async (tx) => {
    const company = await tx.wholesaleCompany.create({
      data: {
        legalName: companyName,
        inn: placeholderInn,
        contactName: input.name.trim(),
        contactPhone: input.phone,
        contactEmail: email,
        // Сразу активная компания с weight-tier прайсом — никаких согласований.
        // Отсрочка и счёт УПД — отдельно через заполнение реквизитов + админ-апрув.
        status: "active",
        paymentTerms: "prepay",
        creditLimit: 0,
        priceListId: defaultPriceListId,
      },
    })
    const user = await tx.wholesaleUser.create({
      data: {
        email,
        emailVerified: new Date(), // самостоятельная регистрация — email считаем подтверждённым
        passwordHash,
        name: input.name.trim(),
        phone: input.phone,
        role: "owner",
        status: "active", // сам юзер активен, но companyStatus=pending_info ограничивает функционал
        companyId: company.id,
      },
    })
    return { company, user }
  })

  // Нотификация менеджеру (tradeagent) о новом самозарегистрировавшемся
  for (const adminEmail of getWholesaleNotificationEmails()) {
    await dispatchEmail({
      orderId: null,
      kind: "wholesale.admin.new_request",
      recipient: adminEmail,
      render: () => ({
        subject: `[ОПТ] Новая регистрация: ${email}`,
        html: `
          <h2>Новый оптовый клиент — самостоятельная регистрация</h2>
          <p><strong>Имя:</strong> ${input.name}</p>
          <p><strong>Телефон:</strong> ${input.phone}</p>
          <p><strong>Email:</strong> ${email}</p>
          ${input.companyName ? `<p><strong>Компания:</strong> ${input.companyName}</p>` : ""}
          <p>Статус: <strong>active</strong>, предоплата, tier-скидки по весу работают.</p>
          <p>Если захочет отсрочку — заполнит реквизиты в кабинете, тогда решение за вами.</p>
        `,
      }),
      send: (e) => sendRenderedEmail(e),
    }).catch(() => {})
  }

  return { companyId: company.id, userId: user.id, email }
}

/**
 * Опциональное заполнение реквизитов — для получения счёта УПД и запроса отсрочки.
 * Компания уже active после регистрации, эта форма не блокирует её работу.
 * После сохранения менеджер видит заявку в админке и может выдать отсрочку + лимит.
 */
export async function submitCompanyInfo(input: {
  legalName: string
  inn: string
  kpp?: string
  ogrn?: string
  legalAddress?: string
  bankName?: string
  bankAccount?: string
  bankBic?: string
  corrAccount?: string
  expectedVolume?: string
}) {
  const ctx = await requireWholesale()
  const inn = input.inn.replace(/\D/g, "")
  if (inn.length !== 10 && inn.length !== 12) {
    throw new Error("ИНН должен быть 10 или 12 цифр")
  }
  if (!input.legalName.trim()) throw new Error("Укажите название организации")

  // Проверка на дубль ИНН — если уже есть активная компания, не позволяем занять
  const innConflict = await prisma.wholesaleCompany.findFirst({
    where: { inn, id: { not: ctx.companyId } },
  })
  if (innConflict) {
    throw new Error("Компания с таким ИНН уже зарегистрирована. Обратитесь к менеджеру.")
  }

  // DaData snapshot — для audit
  const dadata = await findPartyByInn(inn).catch(() => null)

  // Статус НЕ меняем — компания остаётся active и продолжает работать с tier-скидками.
  // Реквизиты нужны для счёта УПД; отсрочку/лимит выдаёт менеджер отдельным действием.
  await prisma.wholesaleCompany.update({
    where: { id: ctx.companyId },
    data: {
      legalName: input.legalName.trim(),
      inn,
      kpp: input.kpp?.trim() || dadata?.data.kpp || null,
      ogrn: input.ogrn?.trim() || dadata?.data.ogrn || null,
      legalAddress:
        input.legalAddress?.trim() || dadata?.data.address?.value || null,
      bankName: input.bankName?.trim() || null,
      bankAccount: input.bankAccount?.trim() || null,
      bankBic: input.bankBic?.trim() || null,
      corrAccount: input.corrAccount?.trim() || null,
      dadataStatus: dadata?.data.state?.status ?? null,
      dadataCheckedAt: dadata ? new Date() : null,
      dadataPayload: dadata ? (dadata as unknown as Prisma.InputJsonValue) : undefined,
    },
  })

  // Нотификация менеджеру + запись заявки для /admin/wholesale/requests
  await prisma.wholesaleAccessRequest.create({
    data: {
      legalName: input.legalName.trim(),
      inn,
      contactName: ctx.name,
      contactPhone: "",
      contactEmail: ctx.email,
      expectedVolume: input.expectedVolume?.trim() || null,
      status: "pending",
      companyId: ctx.companyId,
    },
  })

  for (const adminEmail of getWholesaleNotificationEmails()) {
    await dispatchEmail({
      orderId: null,
      kind: "wholesale.admin.new_request",
      recipient: adminEmail,
      render: () => ({
        subject: `[ОПТ] Реквизиты заполнены: ${input.legalName}`,
        html: `
          <h2>Оптовый клиент заполнил реквизиты</h2>
          <p><strong>Компания:</strong> ${input.legalName} (ИНН ${inn})</p>
          ${dadata?.data.state?.status && dadata.data.state.status !== "ACTIVE" ? `<p style="color:#b91c1c"><strong>⚠ DaData статус:</strong> ${dadata.data.state.status}</p>` : ""}
          <p><strong>Контакт:</strong> ${ctx.name} (${ctx.email})</p>
          <p>Требуется одобрение для активации оптовых цен и отсрочки.</p>
          <p><a href="${process.env.NEXTAUTH_URL || ""}/admin/wholesale/companies/${ctx.companyId}">Открыть компанию в админке</a></p>
        `,
      }),
      send: (e) => sendRenderedEmail(e),
    }).catch(() => {})
  }

  await enqueueOutbox(
    "wholesale.access_request.created",
    {
      event_id: `wa_info_${ctx.companyId}_${Date.now()}`,
      event: "wholesale.access_request.created",
      occurred_at: new Date().toISOString(),
      request: {
        id: ctx.companyId,
        legalName: input.legalName.trim(),
        inn,
        contactName: ctx.name,
        contactEmail: ctx.email,
        admin_url: `/admin/wholesale/companies/${ctx.companyId}`,
      },
    },
    { eventId: `wa_info_${ctx.companyId}` }
  ).catch(() => {})

  revalidatePath("/wholesale")
  revalidatePath("/wholesale/company")
  revalidatePath("/admin/wholesale/requests")
  revalidatePath("/admin/wholesale/companies")

  return { ok: true }
}

/**
 * Менеджер одобряет компанию с заполненными реквизитами.
 * Назначает прайс-лист и условия. После этого status становится "active".
 */
export async function approveCompany(
  companyId: string,
  input: {
    priceListId: string | null
    paymentTerms: "prepay" | "net7" | "net14" | "net30" | "net60"
    creditLimit: number
    managerAdminId: string | null
  }
) {
  const { requireAdmin, logAdminAction } = await import("@/lib/admin-guard")
  const admin = await requireAdmin("wholesale.requests.approve")

  const company = await prisma.wholesaleCompany.findUnique({ where: { id: companyId } })
  if (!company) throw new Error("Компания не найдена")
  if (company.status === "active") throw new Error("Компания уже активна")

  await prisma.wholesaleCompany.update({
    where: { id: companyId },
    data: {
      status: "active",
      priceListId: input.priceListId,
      paymentTerms: input.paymentTerms,
      creditLimit: input.creditLimit,
      managerAdminId: input.managerAdminId,
      approvedById: admin.userId,
      approvedAt: new Date(),
    },
  })

  // Закрываем заявку
  await prisma.wholesaleAccessRequest.updateMany({
    where: { companyId, status: "pending" },
    data: {
      status: "approved",
      reviewedById: admin.userId,
      reviewedAt: new Date(),
    },
  })

  void logAdminAction({
    admin,
    action: "wholesale.company.activated",
    entityType: "wholesale_company",
    entityId: companyId,
    payload: {
      priceListId: input.priceListId,
      paymentTerms: input.paymentTerms,
      creditLimit: input.creditLimit,
    },
  })

  // Клиенту — email «вы активированы»
  await dispatchEmail({
    orderId: null,
    kind: "wholesale.access_request.approved",
    recipient: company.contactEmail ?? "",
    render: () => ({
      subject: "Ваш оптовый кабинет активирован",
      html: `
        <h2>Оптовые цены и отсрочка включены</h2>
        <p>Здравствуйте!</p>
        <p>Менеджер одобрил вашу заявку. Теперь в каталоге действуют тарифные скидки по весу,
           ${input.paymentTerms === "prepay" ? "оплата по предоплате" : `доступна отсрочка ${input.paymentTerms.replace("net", "")} дней на сумму до ${input.creditLimit.toLocaleString("ru")}₽`}.</p>
        <p><a href="${process.env.NEXTAUTH_URL || ""}/wholesale">Войти в кабинет</a></p>
      `,
    }),
    send: (e) => sendRenderedEmail(e),
  }).catch(() => {})

  revalidatePath("/admin/wholesale/companies")
  revalidatePath("/admin/wholesale/requests")
  return { ok: true }
}
