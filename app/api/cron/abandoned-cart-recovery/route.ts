import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendRenderedEmail } from "@/lib/email"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Cron: GET /api/cron/abandoned-cart-recovery
 *
 * Раз в 15 минут (настраивается внешним планировщиком):
 *   1. Находит AbandonedCart со status='tracked' старше 60 минут
 *   2. Генерит одноразовый промо-код (-10% на эту корзину)
 *   3. Шлёт письмо с deep-link на восстановление
 *   4. Помечает status='email_sent'
 *
 * TTL: через 72 часа без recovery → status='expired'. Рекомендую делать
 * одним и тем же cron'ом (расходится путь по createdAt + now()).
 *
 * Авторизация: Authorization: Bearer ${CRON_SECRET}.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const now = Date.now()
  const sixtyMinAgo = new Date(now - 60 * 60 * 1000)
  const seventyTwoHoursAgo = new Date(now - 72 * 60 * 60 * 1000)

  // Expire старые записи.
  const expired = await prisma.abandonedCart.updateMany({
    where: {
      status: { in: ["tracked", "email_sent"] },
      createdAt: { lt: seventyTwoHoursAgo },
    },
    data: { status: "expired" },
  })

  // Ищем кандидатов на отправку — трекнут больше 60 минут назад, не отправляли.
  // Limit 50 за прогон, чтобы не перегружать SMTP.
  const candidates = await prisma.abandonedCart.findMany({
    where: {
      status: "tracked",
      createdAt: { lt: sixtyMinAgo },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  })

  const siteUrl = process.env.NEXTAUTH_URL || "https://millor-coffee.ru"
  let sent = 0
  const errors: string[] = []

  for (const cart of candidates) {
    try {
      // Создаём одноразовый промо-код для этой корзины.
      // Не стэкается с welcome-discount (в createOrder promoCode приоритетнее).
      const promoCode = `WBACK-${cart.id.slice(-6).toUpperCase()}`
      await prisma.promoCode.create({
        data: {
          code: promoCode,
          name: `Cart recovery ${cart.email.replace(/(.{1}).*(@.*)/, "$1***$2")}`,
          comment: `Auto-generated для AbandonedCart ${cart.id}`,
          type: "percent",
          value: 10,
          maxUsage: 1,
          maxPerCustomer: 1,
          minOrderSum: Math.max(500, Math.floor(cart.subtotal * 0.8)),
          startDate: new Date(now),
          endDate: new Date(now + 72 * 60 * 60 * 1000),
          isActive: true,
        },
      })

      const recoveryUrl = `${siteUrl}/cart/restore?token=${encodeURIComponent(cart.recoveryToken)}`

      const items = Array.isArray(cart.items) ? (cart.items as Array<{ name: string; weight: string; quantity: number; price: number }>) : []
      const itemsHtml = items
        .map(
          (i) =>
            `<tr><td style="padding:8px 0;color:#333;">${i.name} · ${i.weight} × ${i.quantity}</td><td style="padding:8px 0;text-align:right;color:#333;"><strong>${i.price * i.quantity}₽</strong></td></tr>`
        )
        .join("")

      await sendRenderedEmail({
        to: cart.email,
        subject: `Ваш кофе ждёт · скидка 10% с кодом ${promoCode}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #2d6b4a; margin: 0 0 12px;">Продолжить оформление?</h2>
            <p>Вы не закончили заказ — мы сохранили корзину, и готовы предложить скидку 10% чтобы вы точно успели до следующей обжарки:</p>

            <table style="width:100%;border-collapse:collapse;margin:16px 0;border-top:1px solid #eee;">
              ${itemsHtml}
              <tr><td style="padding:8px 0;border-top:1px solid #eee;"><strong>Подытог</strong></td><td style="padding:8px 0;text-align:right;border-top:1px solid #eee;"><strong>${cart.subtotal}₽</strong></td></tr>
            </table>

            <div style="background:#f7efe5;border-radius:12px;padding:16px;margin:20px 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:14px;color:#6b5340;">Промокод на одноразовую скидку</p>
              <p style="margin:0;font-family:monospace;font-size:22px;letter-spacing:2px;color:#2d6b4a;font-weight:bold;">${promoCode}</p>
              <p style="margin:6px 0 0;font-size:11px;color:#6b5340;">Действителен 72 часа · применится автоматически</p>
            </div>

            <p style="margin:20px 0;text-align:center;">
              <a href="${recoveryUrl}" style="display:inline-block;background:#2d6b4a;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:500;">
                Вернуться в корзину →
              </a>
            </p>

            <p style="color:#888;font-size:12px;margin-top:28px;">Если вы уже оформили заказ — проигнорируйте это письмо. Мы не отправим его повторно.</p>
          </div>
        `,
      })

      await prisma.abandonedCart.update({
        where: { id: cart.id },
        data: {
          status: "email_sent",
          emailSentAt: new Date(),
          promoCodeId: null, // храним code в promo-системе; ссылку на id не держим
        },
      })
      sent++
    } catch (e) {
      errors.push(
        `${cart.id}: ${e instanceof Error ? e.message : "unknown"}`
      )
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    sent,
    expired: expired.count,
    errors,
  })
}
