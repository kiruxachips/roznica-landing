import { NextResponse } from "next/server"
import { z } from "zod"
import { timingSafeEqual } from "crypto"
import { prisma } from "@/lib/prisma"
import { getPayment } from "@/lib/yookassa"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * I5 (B-1): легковесный публичный эндпоинт для PendingPaymentBanner.
 *
 * Принимает orderNumber + trackingToken (proof of ownership — иначе
 * отдавали бы статус чужих заказов). Возвращает компактный объект:
 *   - status: "pending" | "paid" | "cancelled" | "not-found" | "expired"
 *   - paymentUrl: свежий confirmation_url из YooKassa, если ещё валиден
 *
 * `paymentUrl` НЕ возвращается без token-проверки даже для pending —
 * чтобы не давать атакующему «вечную» ссылку на чужую оплату.
 *
 * orderNumber формат `MC-DDMMYY-XXXX` ≈ 1.6M комбинаций на день — слабая
 * энтропия для брутфорса, поэтому жёсткая проверка trackingToken.
 */

const QuerySchema = z.object({
  orderNumber: z
    .string()
    .min(8)
    .max(20)
    .regex(/^[A-Z0-9-]+$/),
  trackingToken: z
    .string()
    .min(20)
    .max(80)
    .regex(/^[a-f0-9]+$/),
})

export async function GET(request: Request) {
  const url = new URL(request.url)
  let parsed: z.infer<typeof QuerySchema>
  try {
    parsed = QuerySchema.parse({
      orderNumber: url.searchParams.get("orderNumber"),
      trackingToken: url.searchParams.get("trackingToken"),
    })
  } catch {
    return NextResponse.json({ status: "not-found" }, { status: 200 })
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber: parsed.orderNumber },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paymentId: true,
      trackingToken: true,
    },
  })

  // Pass-2-G: constant-time compare. Не палим существование заказа при
  // невалидном token — отвечаем "not-found". timingSafeEqual требует
  // одинаковой длины, поэтому len-check сначала.
  const tokenOk =
    !!order?.trackingToken &&
    order.trackingToken.length === parsed.trackingToken.length &&
    timingSafeEqual(
      Buffer.from(order.trackingToken),
      Buffer.from(parsed.trackingToken)
    )
  if (!order || !tokenOk) {
    return NextResponse.json({ status: "not-found" }, { status: 200 })
  }

  // Уже оплачено / отменено — банер должен скрыться.
  if (order.paymentStatus === "succeeded" || order.status === "paid") {
    return NextResponse.json({ status: "paid", paymentUrl: null })
  }
  if (order.status === "cancelled" || order.paymentStatus === "canceled") {
    return NextResponse.json({ status: "cancelled", paymentUrl: null })
  }

  // Pending — пробуем достать свежий confirmation_url из YooKassa.
  // Если YooKassa тоже скажет «истёк/отменён» → отвечаем "expired",
  // фронт покажет кнопку «Создать новую ссылку» (вызывает /repay).
  if (order.paymentId) {
    try {
      const payment = await getPayment(order.paymentId)
      const url = payment.confirmation?.confirmation_url ?? null
      if (payment.status === "pending" && url) {
        return NextResponse.json({ status: "pending", paymentUrl: url })
      }
      if (payment.status === "succeeded") {
        return NextResponse.json({ status: "paid", paymentUrl: null })
      }
      if (payment.status === "canceled") {
        return NextResponse.json({ status: "cancelled", paymentUrl: null })
      }
      // YooKassa вернул что-то странное / нет URL — считаем expired.
      return NextResponse.json({ status: "expired", paymentUrl: null })
    } catch (e) {
      console.error("[check-pending] yookassa getPayment failed:", e)
      // Не роняем banner — пусть фронт покажет «попробуйте позже».
      return NextResponse.json({ status: "expired", paymentUrl: null })
    }
  }

  // Order pending, но paymentId нет (orphan-state, не должно случаться).
  return NextResponse.json({ status: "expired", paymentUrl: null })
}
