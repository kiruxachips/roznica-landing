import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendRenderedEmail } from "@/lib/email"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * Cron: GET /api/cron/subscriptions-create-orders
 *
 * Раз в день утром: находит Subscription со status=active и
 * nextDeliveryDate <= today, шлёт юзеру email с reminder'ом и ссылкой на
 * checkout с pre-filled корзиной (через query-params).
 *
 * ПОЧЕМУ не создаём Order автоматически:
 *   - Recurring-платежи через ЮKassa требуют отдельного договора и
 *     сохранения PAN, что добавляет compliance и техдолг.
 *   - Для MVP: email → юзер кликает → /catalog/[slug] с query ?qty + переход
 *     в корзину → обычный checkout. Конверсия ниже, но implementation проще.
 *
 * В будущем: интеграция с ЮKassa saved-cards → прямое списание.
 *
 * Idempotency: обновляем nextDeliveryDate = today + intervalDays ТОЛЬКО
 * после успешной отправки email. При повторном запуске того же дня
 * фильтр уже не пустит.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const candidates = await prisma.subscription.findMany({
    where: {
      status: "active",
      nextDeliveryDate: { lte: now },
    },
    include: {
      user: { select: { email: true, name: true } },
      variant: {
        select: {
          weight: true,
          price: true,
          stock: true,
          isActive: true,
          product: { select: { name: true, slug: true, isActive: true } },
        },
      },
    },
    take: 100,
  })

  const siteUrl = process.env.NEXTAUTH_URL || "https://millor-coffee.ru"
  let notified = 0
  const errors: string[] = []

  for (const sub of candidates) {
    try {
      if (!sub.user?.email) {
        errors.push(`${sub.id}: нет email`)
        continue
      }
      if (!sub.variant.product.isActive || !sub.variant.isActive) {
        // Товар снят с каталога → паузим подписку (не отменяем — юзер сам
        // выберет что делать).
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "paused", pausedUntil: new Date(Date.now() + 30 * 86_400_000) },
        })
        errors.push(`${sub.id}: товар недоступен, поставили на паузу`)
        continue
      }
      if (sub.variant.stock < sub.quantity) {
        // Не хватает — сдвигаем на 3 дня и пробуем снова.
        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            nextDeliveryDate: new Date(now.getTime() + 3 * 86_400_000),
          },
        })
        errors.push(`${sub.id}: нет на складе, сдвиг +3 дня`)
        continue
      }

      // Crash-safety: сдвигаем nextDeliveryDate РАНЬШЕ send через conditional
      // update. Если два крона запустились параллельно или retry случился
      // между send и старым update, только один поток пройдёт OCC-проверку
      // (WHERE nextDeliveryDate=prev).
      const claimed = await prisma.subscription.updateMany({
        where: {
          id: sub.id,
          nextDeliveryDate: sub.nextDeliveryDate,
        },
        data: {
          nextDeliveryDate: new Date(now.getTime() + sub.intervalDays * 86_400_000),
        },
      })
      if (claimed.count === 0) {
        // Параллельный процесс уже сдвинул дату — пропускаем.
        continue
      }

      const checkoutUrl = `${siteUrl}/catalog/${sub.variant.product.slug}?subscribe=${sub.id}`

      await sendRenderedEmail({
        to: sub.user.email,
        subject: `Время следующей доставки · ${sub.variant.product.name}`,
        html: `
          <div style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #2d6b4a;">Пора обновить запас</h2>
            <p>Здравствуйте${sub.user.name ? ", " + sub.user.name : ""}!</p>
            <p>По вашей подписке — ${sub.variant.product.name} (${sub.variant.weight}) × ${sub.quantity} шт. готов к отправке. Стоимость с учётом скидки подписки ${sub.discountPercent}% уже в корзине.</p>

            <p style="margin:20px 0;text-align:center;">
              <a href="${checkoutUrl}" style="display:inline-block;background:#2d6b4a;color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:500;">
                Оформить доставку
              </a>
            </p>

            <p style="color:#666;font-size:13px;">Не нужна доставка? <a href="${siteUrl}/account/subscriptions" style="color:#2d6b4a;">Управление подпиской</a> — можно поставить на паузу или отменить.</p>
          </div>
        `,
      })

      notified++
    } catch (e) {
      errors.push(`${sub.id}: ${e instanceof Error ? e.message : "unknown"}`)
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    notified,
    errors,
  })
}
