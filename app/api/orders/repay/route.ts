import { NextResponse } from "next/server"
import { z } from "zod"
import { headers } from "next/headers"
import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { createPayment } from "@/lib/yookassa"
import { checkRateLimit } from "@/lib/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * I5 (B-2): пересоздать платёж для существующего pending-заказа.
 *
 * Зачем нужно: confirmation_url у YooKassa живёт ~10 минут. Если юзер
 * вернулся через час, старая ссылка протухла. createPayment с тем же
 * Idempotence-Key=orderId вернёт КЭШИРОВАННЫЙ платёж со старым
 * confirmation_url — поэтому нужен новый ключ + перезапись paymentId.
 *
 * Безопасность: proof of ownership через trackingToken (хранится в
 * localStorage клиента). Без token не отвечаем — иначе атакующий мог бы
 * генерить YooKassa-платежи для чужих заказов и получать ссылки.
 *
 * Idempotency: для одного и того же trackingToken+orderId за окно 30 сек
 * возвращаем тот же URL — дабл-клик на «Создать новую ссылку» не создаст
 * 5 платежей. Контролируется через `repayLastAt` поле (TODO в B-2.1) или
 * проверкой текущего payment.status — если уже pending и < 30 сек,
 * возвращаем существующий.
 */

const BodySchema = z.object({
  orderId: z.string().min(20).max(40),
  trackingToken: z
    .string()
    .min(20)
    .max(80)
    .regex(/^[a-f0-9]+$/),
})

export async function POST(request: Request) {
  let parsed: z.infer<typeof BodySchema>
  try {
    parsed = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 })
  }

  // Pass-2-G (post-B-audit CRITICAL): rate-limit. Без него атакующий с
  // украденным trackingToken мог бы за минуту создать сотни платежей в
  // YooKassa (DoS на квоту + orphan-Payment'ы). Двухуровневый ключ:
  //  - per-orderId: 1 repay в 30 сек (нормальный кейс — 1 кнопка раз в час).
  //  - per-IP: 10 repay в 5 минут (защита от перебора по разным orderId).
  const ipHeader = (await headers()).get("x-forwarded-for") || ""
  const ip = ipHeader.split(",")[0]?.trim() || "unknown"
  const orderLimit = checkRateLimit(`repay:order:${parsed.orderId}`, {
    max: 1,
    windowMs: 30_000,
    blockMs: 30_000,
  })
  if (!orderLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limited", message: "Слишком частые запросы — подождите 30 секунд" },
      { status: 429, headers: { "Retry-After": String(orderLimit.retryAfter ?? 30) } }
    )
  }
  const ipLimit = checkRateLimit(`repay:ip:${ip}`, {
    max: 10,
    windowMs: 5 * 60_000,
    blockMs: 5 * 60_000,
  })
  if (!ipLimit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter ?? 300) } }
    )
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.orderId },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      status: true,
      paymentStatus: true,
      trackingToken: true,
      thankYouToken: true,
    },
  })

  // Pass-2-G: constant-time compare для trackingToken — закрывает
  // теоретическую timing-атаку. Также отвергаем не-совпавшие длины,
  // потому что timingSafeEqual выбросит на разных размерах.
  const tokenOk =
    !!order?.trackingToken &&
    order.trackingToken.length === parsed.trackingToken.length &&
    timingSafeEqual(
      Buffer.from(order.trackingToken),
      Buffer.from(parsed.trackingToken)
    )
  if (!order || !tokenOk) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  if (order.status === "cancelled" || order.paymentStatus === "canceled") {
    return NextResponse.json(
      { error: "cancelled", message: "Заказ был отменён, оформите новый" },
      { status: 409 }
    )
  }
  if (order.paymentStatus === "succeeded" || order.status === "paid") {
    return NextResponse.json(
      { error: "already_paid", message: "Заказ уже оплачен" },
      { status: 409 }
    )
  }

  // Возвращаемся через тот же thank-you flow.
  const headersList = await headers()
  const host = headersList.get("host") || "millor-coffee.ru"
  const protocol = headersList.get("x-forwarded-proto") || "https"
  const baseUrl = `${protocol}://${host}`
  const returnUrl = `${baseUrl}/thank-you?order=${order.orderNumber}&token=${order.thankYouToken ?? ""}`

  let payment
  try {
    payment = await createPayment({
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: order.total,
      returnUrl,
      description: `Заказ ${order.orderNumber} — Millor Coffee (повторная оплата)`,
      // Уникальный per-repay key — иначе YooKassa вернёт старый кэш.
      // `repay-` префикс + ms-timestamp гарантирует свежий платёж.
      idempotenceKey: `repay-${order.id}-${Date.now()}`,
    })
  } catch (e) {
    console.error("[repay] createPayment failed:", e)
    return NextResponse.json(
      { error: "payment_create_failed" },
      { status: 502 }
    )
  }

  const paymentUrl = payment.confirmation?.confirmation_url
  if (!paymentUrl) {
    return NextResponse.json(
      { error: "no_url_returned" },
      { status: 502 }
    )
  }

  // Старый paymentId перезаписываем — webhook будет искать по новому.
  // Старый платёж (если webhook когда-то придёт со statusом canceled)
  // не найдёт заказ → log warn, без побочек (стек проверен в webhook:99).
  await prisma.order.update({
    where: { id: order.id },
    data: { paymentId: payment.id, paymentStatus: "pending" },
  })

  return NextResponse.json({ paymentUrl, expiresAt: Date.now() + 10 * 60 * 1000 })
}
