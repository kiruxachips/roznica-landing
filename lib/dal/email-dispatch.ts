import { prisma } from "@/lib/prisma"

/**
 * Единая точка исходящей отправки писем — audit + idempotency.
 *
 * Каждый вызов `send*` из `lib/email.ts` должен идти через эту обёртку.
 * Гарантии:
 *  - Идемпотентность: если для `(orderId, kind, recipient)` уже есть запись со `status="sent"`,
 *    повторная отправка пропускается. Это защищает от дублей при ретраях YooKassa-webhook'а,
 *    повторных millorbot-событиях и race-conditions.
 *  - Audit: каждая попытка (успех или ошибка) фиксируется строкой в `EmailDispatch`. Админ
 *    всегда может посмотреть, ушло ли письмо (messageId из SMTP-ответа) или упало (error).
 *  - Не throws: обёртка молча глотает ошибки SMTP, пишет `status="failed"` и лог. Это
 *    исключает падение основного хэндлера (создание заказа, webhook). Для критичных мест,
 *    где нужно знать результат — смотри `dispatchEmailOrThrow`.
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

export interface SendEmailResult {
  messageId?: string
  response?: string
}

export interface DispatchOpts {
  orderId: string | null
  kind: EmailDispatchKind
  recipient: string
  send: () => Promise<SendEmailResult | void>
}

/**
 * Отправляет письмо с записью в EmailDispatch. Не пробрасывает ошибки наружу —
 * всегда резолвится, callers могут не wrap-ить в try/catch.
 */
export async function dispatchEmail(opts: DispatchOpts): Promise<void> {
  const { orderId, kind, recipient, send } = opts

  if (!recipient) {
    // Писать абсолютно пустому получателю бессмысленно. Фиксируем как failed,
    // чтобы в admin-панели было видно, что попытка была и она отфильтрована.
    await safeRecord({ orderId, kind, recipient: "", status: "failed", error: "empty recipient" })
    return
  }

  // Idempotency: уже уходило?
  const already = await prisma.emailDispatch.findFirst({
    where: { orderId, kind, recipient, status: "sent" },
    select: { id: true },
  })
  if (already) return

  try {
    const res = (await send()) as SendEmailResult | void
    await safeRecord({
      orderId,
      kind,
      recipient,
      status: "sent",
      messageId: res?.messageId,
      response: res?.response?.slice(0, 500),
    })
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    await safeRecord({
      orderId,
      kind,
      recipient,
      status: "failed",
      error: msg.slice(0, 500),
    })
    // stdout — на случай если БД недоступна, хоть что-то видно в логах контейнера.
    console.error(`[email] ${kind} → ${recipient} failed:`, msg)
  }
}

/**
 * Вариант, пробрасывающий ошибку наружу. Нужен там, где вызывающий код принимает решения
 * на основе результата (напр. не продолжать flow, если письмо не ушло).
 * Обычно не нужен — предпочитайте `dispatchEmail`.
 */
export async function dispatchEmailOrThrow(opts: DispatchOpts): Promise<void> {
  const { orderId, kind, recipient, send } = opts
  if (!recipient) throw new Error("empty recipient")
  const already = await prisma.emailDispatch.findFirst({
    where: { orderId, kind, recipient, status: "sent" },
    select: { id: true },
  })
  if (already) return
  try {
    const res = (await send()) as SendEmailResult | void
    await safeRecord({
      orderId,
      kind,
      recipient,
      status: "sent",
      messageId: res?.messageId,
      response: res?.response?.slice(0, 500),
    })
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    await safeRecord({ orderId, kind, recipient, status: "failed", error: msg.slice(0, 500) })
    throw e
  }
}

interface RecordArgs {
  orderId: string | null
  kind: string
  recipient: string
  status: "sent" | "failed"
  messageId?: string
  response?: string
  error?: string
}

async function safeRecord(args: RecordArgs) {
  try {
    await prisma.emailDispatch.create({
      data: {
        orderId: args.orderId,
        kind: args.kind,
        recipient: args.recipient,
        status: args.status,
        messageId: args.messageId ?? null,
        response: args.response ?? null,
        error: args.error ?? null,
      },
    })
  } catch (e) {
    // Если БД недоступна — максимум что можем, это stdout.
    console.error("[email-dispatch] failed to record row:", e)
  }
}
