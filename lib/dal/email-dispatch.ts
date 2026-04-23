import { prisma } from "@/lib/prisma"

/**
 * Единая точка исходящей отправки писем — audit + idempotency + durable queue.
 *
 * Архитектура:
 *  1. dispatchEmail вызывается с уже отрендеренным письмом {to, subject, html}.
 *  2. Сначала INSERT EmailDispatch со status="pending" и snapshot'ом письма.
 *     Это даёт durability: если после этого процесс убьют, письмо всё равно в БД.
 *  3. После успеха коммита — попытка SMTP.
 *  4. На результат обновляем status=sent | failed, attempts++, nextAttemptAt.
 *  5. Фоновый воркер (scripts/outbox-worker.mjs) сканит pending/failed + nextAttemptAt<=now
 *     и ретраит с экспоненциальным backoff до MAX_ATTEMPTS.
 *
 * Idempotency: если для (orderId, kind, recipient) уже есть status="sent", новый
 * pending не создаётся (skip). Защищает от YooKassa-webhook ретраев и race'ов.
 */

export type EmailDispatchKind =
  | "order.confirmation"
  | "order.payment_success"
  | "order.payment_failed"
  | "order.shipped"
  | "order.delivered"
  | `order.status:${string}`
  | "admin.new_order"
  | "admin.payment_success"
  // P1-11: складские алерты админу. Kind несёт переход stockBefore→stockAfter
  // в строке, чтобы idempotency по (orderId=null, kind, recipient) защищал от
  // дублей при повторных вызовах adjustStock с тем же эффектом.
  | `admin.stock_depleted:${string}`
  | `admin.stock_low:${string}`
  // N-2: уведомление суперадминам о pending-менеджере
  | `admin.pending_manager:${string}`

export interface RenderedEmail {
  subject: string
  html: string
  fromEmail?: string
}

export interface SendEmailResult {
  messageId?: string
  response?: string
}

export interface DispatchOpts {
  orderId: string | null
  kind: EmailDispatchKind
  recipient: string
  render: () => RenderedEmail | Promise<RenderedEmail>
  send: (email: RenderedEmail & { to: string }) => Promise<SendEmailResult>
}

const MAX_ATTEMPTS = 5

/**
 * Создаёт EmailDispatch-запись и пытается отправить письмо через SMTP.
 * Не throws наружу. Callers безопасно вызывают в `after()`.
 *
 * При SMTP-ошибке письмо остаётся в таблице со status="failed", воркер подхватит.
 * При успехе — status="sent", messageId заполнен.
 */
export async function dispatchEmail(opts: DispatchOpts): Promise<void> {
  const { orderId, kind, recipient } = opts

  if (!recipient) {
    // Фиксируем неудачный attempt чтобы было видно, что была попытка без адресата.
    await safeCreate({
      orderId,
      kind,
      recipient: "",
      status: "dead",
      attempts: 1,
      error: "empty recipient",
    })
    return
  }

  // Idempotency: если уже sent — skip.
  const alreadySent = await prisma.emailDispatch.findFirst({
    where: { orderId, kind, recipient, status: "sent" },
    select: { id: true },
  })
  if (alreadySent) return

  // Render + insert pending (snapshot на случай рестарта).
  let rendered: RenderedEmail
  try {
    rendered = await opts.render()
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    await safeCreate({
      orderId,
      kind,
      recipient,
      status: "dead",
      attempts: 1,
      error: `render failed: ${msg}`,
    })
    return
  }

  const row = await safeCreate({
    orderId,
    kind,
    recipient,
    status: "pending",
    attempts: 0,
    subject: rendered.subject,
    html: rendered.html,
    fromEmail: rendered.fromEmail ?? null,
  })
  if (!row) return // БД недоступна — ничего не поделать

  // Сразу пытаемся отправить. Если воркер подхватит до — dispatchEmail попытается повторно,
  // но idempotency по status="sent" защитит от дубля.
  await attemptSend(row.id, opts.send, { ...rendered, to: recipient })
}

/**
 * Попытка отправить pending/failed запись. Используется dispatchEmail и воркером.
 */
export async function attemptSend(
  dispatchId: string,
  send: (email: { to: string; subject: string; html: string; fromEmail?: string }) => Promise<SendEmailResult>,
  email: { to: string; subject: string; html: string; fromEmail?: string }
): Promise<void> {
  try {
    const res = await send(email)
    await prisma.emailDispatch.update({
      where: { id: dispatchId },
      data: {
        status: "sent",
        messageId: res.messageId ?? null,
        response: res.response?.slice(0, 500) ?? null,
        sentAt: new Date(),
        attempts: { increment: 1 },
        error: null,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    const current = await prisma.emailDispatch.findUnique({
      where: { id: dispatchId },
      select: { attempts: true },
    })
    const nextAttempts = (current?.attempts ?? 0) + 1
    const isDead = nextAttempts >= MAX_ATTEMPTS
    await prisma.emailDispatch.update({
      where: { id: dispatchId },
      data: {
        status: isDead ? "dead" : "failed",
        attempts: nextAttempts,
        error: msg.slice(0, 500),
        nextAttemptAt: isDead ? new Date() : new Date(Date.now() + backoffMs(nextAttempts)),
      },
    })
    console.error(`[email] dispatch ${dispatchId} ${isDead ? "DEAD" : "failed"}:`, msg)
  }
}

// Экспоненциальный backoff: 10s, 60s, 5min, 30min, 3h (MAX_ATTEMPTS=5).
function backoffMs(attempts: number): number {
  const table = [10_000, 60_000, 300_000, 1_800_000, 10_800_000]
  return table[Math.min(attempts - 1, table.length - 1)]
}

interface CreateArgs {
  orderId: string | null
  kind: string
  recipient: string
  status: "pending" | "sent" | "failed" | "dead"
  attempts: number
  subject?: string
  html?: string
  fromEmail?: string | null
  error?: string
  nextAttemptAt?: Date
}

async function safeCreate(args: CreateArgs): Promise<{ id: string } | null> {
  try {
    return await prisma.emailDispatch.create({
      data: {
        orderId: args.orderId,
        kind: args.kind,
        recipient: args.recipient,
        status: args.status,
        attempts: args.attempts,
        subject: args.subject ?? null,
        html: args.html ?? null,
        fromEmail: args.fromEmail ?? null,
        error: args.error ?? null,
        nextAttemptAt: args.nextAttemptAt ?? new Date(),
      },
      select: { id: true },
    })
  } catch (e) {
    console.error("[email-dispatch] failed to create row:", e)
    return null
  }
}
