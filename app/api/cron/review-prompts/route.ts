import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendRenderedEmail } from "@/lib/email"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Cron: GET /api/cron/review-prompts
 *
 * Раз в день (обычно ночью) шлёт email-приглашение оставить отзыв клиентам,
 * чей заказ был доставлен 7±1 дней назад. Идемпотентно через EmailDispatch
 * idempotency key (orderId, kind="review.request", recipient, status="sent").
 *
 * Limit 50 заказов за прогон.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const now = Date.now()
  const sevenDaysAgo = new Date(now - 7 * 86_400_000)
  const eightDaysAgo = new Date(now - 8 * 86_400_000)

  // Ищем заказы которые были delivered 7-8 дней назад (updatedAt — момент
  // последнего statusLog, т.к. delivered статус ставится в updateOrderStatus).
  // Для точности стоило бы читать OrderStatusLog.createdAt WHERE toStatus='delivered',
  // но updatedAt — достаточное приближение (статус-changes обновляют updatedAt).
  const candidates = await prisma.order.findMany({
    where: {
      status: "delivered",
      updatedAt: { gte: eightDaysAgo, lt: sevenDaysAgo },
      customerEmail: { not: null },
    },
    take: 50,
    select: {
      id: true,
      orderNumber: true,
      customerEmail: true,
      customerName: true,
      items: {
        select: {
          productId: true,
          name: true,
          product: { select: { slug: true } },
        },
      },
    },
  })

  const siteUrl = process.env.NEXTAUTH_URL || "https://millor-coffee.ru"
  let sent = 0
  const errors: string[] = []

  for (const order of candidates) {
    if (!order.customerEmail) continue

    // Idempotency-check через EmailDispatch: не шлём повторно.
    const existing = await prisma.emailDispatch.findFirst({
      where: {
        orderId: order.id,
        kind: "review.request",
        recipient: order.customerEmail,
        status: "sent",
      },
    })
    if (existing) continue

    try {
      // Берём первый товар заказа для персонализации ссылки.
      // Если товаров несколько — юзер видит в письме все, кликает в один из.
      const firstProduct = order.items[0]?.product
      const itemsList = order.items
        .slice(0, 5)
        .map(
          (i) =>
            `<li style="margin:4px 0;"><a href="${siteUrl}/catalog/${i.product?.slug || ""}?review=${order.id}" style="color:#2d6b4a;">${i.name}</a></li>`
        )
        .join("")

      const primaryLink = firstProduct
        ? `${siteUrl}/catalog/${firstProduct.slug}?review=${order.id}`
        : `${siteUrl}/catalog`

      // Идемпотентно регистрируем EmailDispatch как "sent" после фактической отправки.
      await sendRenderedEmail({
        to: order.customerEmail,
        subject: `Как вам кофе из заказа ${order.orderNumber}? Оставьте отзыв · +100 бонусов`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #2d6b4a; margin: 0 0 12px;">Как вам кофе?</h2>
            <p>Здравствуйте${order.customerName ? ", " + order.customerName : ""}!</p>
            <p>Ваш заказ ${order.orderNumber} приехал неделю назад. Если успели распробовать — поделитесь впечатлениями. За каждый отзыв начислим <strong>100 бонусов</strong>.</p>

            <ul style="margin:16px 0;padding-left:20px;color:#444;">${itemsList}</ul>

            <p style="margin:20px 0;text-align:center;">
              <a href="${primaryLink}" style="display:inline-block;background:#2d6b4a;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:500;">
                Оставить отзыв
              </a>
            </p>

            <p style="color:#666;font-size:13px;">Ваше мнение помогает нам и другим выбирать правильный кофе. Спасибо!</p>
            <p style="color:#888;font-size:12px;margin-top:28px;">Это письмо отправлено один раз — повторно не побеспокоим.</p>
          </div>
        `,
      })

      await prisma.emailDispatch.create({
        data: {
          orderId: order.id,
          kind: "review.request",
          recipient: order.customerEmail,
          status: "sent",
          attempts: 1,
          subject: `Отзыв о заказе ${order.orderNumber}`,
          sentAt: new Date(),
        },
      })
      sent++
    } catch (e) {
      errors.push(`${order.orderNumber}: ${e instanceof Error ? e.message : "unknown"}`)
      // Записываем как failed — ретраер подхватит позже.
      await prisma.emailDispatch.create({
        data: {
          orderId: order.id,
          kind: "review.request",
          recipient: order.customerEmail,
          status: "failed",
          attempts: 1,
          subject: `Отзыв о заказе ${order.orderNumber}`,
          error: e instanceof Error ? e.message.slice(0, 500) : "unknown",
        },
      })
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    sent,
    errors,
  })
}
