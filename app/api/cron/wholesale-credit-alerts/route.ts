import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { dispatchEmail } from "@/lib/dal/email-dispatch"
import { sendRenderedEmail, getAdminNotificationEmails } from "@/lib/email"
import { enqueueOutbox } from "@/lib/dal/outbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALERT_THRESHOLDS = [80, 90, 100] // порог в процентах
const RE_ALERT_AFTER_HOURS = 24 // не спамим чаще раза в сутки на одном пороге

/**
 * Проверяет все активные компании с кредитным лимитом. Если creditUsed/creditLimit
 * пересёк один из порогов ALERT_THRESHOLDS и мы ещё не уведомляли об этом пороге
 * (или уведомляли > 24 часов назад), шлёт email менеджерам + событие в Millorbot.
 *
 * Идемпотентно: creditAlertPctSent + creditAlertSentAt ведут последний
 * отправленный уровень. При падении creditUsed → мы сбрасываем pctSent, чтобы
 * следующий рост снова триггерил алерт.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 })
  }
  const actual = request.headers.get("x-cron-secret")
  if (actual !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 401 })
  }

  const companies = await prisma.wholesaleCompany.findMany({
    where: { status: "active", creditLimit: { gt: 0 } },
    select: {
      id: true,
      legalName: true,
      inn: true,
      creditLimit: true,
      creditUsed: true,
      creditAlertPctSent: true,
      creditAlertSentAt: true,
      managerAdminId: true,
    },
  })

  const now = new Date()
  const reAlertCutoff = new Date(Date.now() - RE_ALERT_AFTER_HOURS * 3600 * 1000)
  const adminEmails = getAdminNotificationEmails()

  let alerted = 0
  let reset = 0

  for (const c of companies) {
    const pct = Math.floor((c.creditUsed / c.creditLimit) * 100)

    // Reset: если процент упал НИЖЕ всех порогов и ранее был алерт — чистим состояние.
    if (pct < ALERT_THRESHOLDS[0] && c.creditAlertPctSent !== null) {
      await prisma.wholesaleCompany.update({
        where: { id: c.id },
        data: { creditAlertPctSent: null, creditAlertSentAt: null },
      })
      reset++
      continue
    }

    // Находим максимальный достигнутый порог
    const highestCrossed = [...ALERT_THRESHOLDS]
      .reverse()
      .find((t) => pct >= t)
    if (!highestCrossed) continue

    // Уже уведомляли об этом уровне — пропускаем (unless cooldown истёк)
    const alreadyAlerted =
      c.creditAlertPctSent !== null && c.creditAlertPctSent >= highestCrossed
    const cooldownExpired =
      c.creditAlertSentAt !== null && c.creditAlertSentAt < reAlertCutoff
    if (alreadyAlerted && !cooldownExpired) continue

    // Шлём алерт
    const available = c.creditLimit - c.creditUsed
    const subject = `[ОПТ] Кредитный лимит ${c.legalName}: ${pct}% использовано`
    const html = `
      <h2>Предупреждение по кредитному лимиту</h2>
      <p><strong>Компания:</strong> ${c.legalName} (ИНН ${c.inn})</p>
      <p><strong>Лимит:</strong> ${c.creditLimit.toLocaleString("ru")}₽</p>
      <p><strong>Использовано:</strong> ${c.creditUsed.toLocaleString("ru")}₽ (${pct}%)</p>
      <p><strong>Доступно:</strong> ${available.toLocaleString("ru")}₽</p>
      <p><a href="${process.env.NEXTAUTH_URL || ""}/admin/wholesale/companies/${c.id}">Открыть в админке</a></p>
    `

    // Email всем admin-notification-адресам; плюс персональный менеджер если есть
    const recipients = new Set<string>(adminEmails)
    if (c.managerAdminId) {
      const mgr = await prisma.adminUser.findUnique({
        where: { id: c.managerAdminId },
        select: { email: true },
      })
      if (mgr?.email) recipients.add(mgr.email)
    }

    for (const r of recipients) {
      await dispatchEmail({
        orderId: null,
        kind: "wholesale.admin.new_order", // переиспользуем kind слот
        recipient: r,
        render: () => ({ subject, html }),
        send: (e) => sendRenderedEmail(e),
      }).catch(() => {})
    }

    await enqueueOutbox(
      "wholesale.credit.limit_warning",
      {
        event_id: `wh_credit_${c.id}_${highestCrossed}_${now.toISOString()}`,
        event: "wholesale.credit.limit_warning",
        occurred_at: now.toISOString(),
        company: {
          id: c.id,
          legalName: c.legalName,
          inn: c.inn,
          creditLimit: c.creditLimit,
          creditUsed: c.creditUsed,
          creditPctUsed: pct,
          threshold: highestCrossed,
        },
      },
      { eventId: `wh_credit_${c.id}_${highestCrossed}_${now.toISOString().slice(0, 10)}` }
    ).catch(() => {})

    await prisma.wholesaleCompany.update({
      where: { id: c.id },
      data: {
        creditAlertPctSent: highestCrossed,
        creditAlertSentAt: now,
      },
    })
    alerted++
  }

  return NextResponse.json({ checked: companies.length, alerted, reset })
}
