import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { generateToken } from "@/lib/tokens"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * POST /api/cart/track-abandoned
 *
 * Тонкий tracking: при вводе email на checkout step 1 (ContactStep) клиент
 * вызывает этот endpoint с snapshot корзины. Если юзер завершит заказ
 * в течение ближайшего часа — email_sent status предотвратит отправку.
 * Если нет — cron через 1-2 часа отправит recovery email.
 *
 * Идемпотентно: повторные вызовы с тем же email обновляют существующий
 * snapshot (не создают дубликаты).
 */
interface TrackBody {
  email: string
  items: Array<{
    variantId: string
    productId: string
    name: string
    weight: string
    price: number
    quantity: number
    slug: string
    image?: string | null
  }>
}

export async function POST(request: Request) {
  const body = (await request.json()) as TrackBody
  if (!body?.email || !body.items?.length) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 })
  }
  const email = body.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid email" }, { status: 400 })
  }

  const subtotal = body.items.reduce((s, i) => s + i.price * i.quantity, 0)
  if (subtotal < 500) {
    // Для очень маленьких корзин recovery email — спам. Не трекаем.
    return NextResponse.json({ ok: true, skipped: true })
  }

  const session = await auth()
  const userId =
    (session?.user as Record<string, unknown> | undefined)?.userType === "customer"
      ? session?.user?.id ?? null
      : null

  // Идемпотентность: для одного email сохраняем только последний snapshot
  // в статусе "tracked" или "email_sent". Если recovered — не перезаписываем.
  const existing = await prisma.abandonedCart.findFirst({
    where: { email, status: { in: ["tracked", "email_sent"] } },
    orderBy: { createdAt: "desc" },
  })

  if (existing) {
    // Если предыдущий snapshot заметно отличается от нового (по составу
    // товаров или сумме >20%) и с момента последнего email прошло >6 часов,
    // сбрасываем в tracked — юзер вернулся с новыми намерениями, cron
    // пришлёт новый recovery-email. Это редкий кейс, но важный для conversion.
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000)
    const significantChange =
      existing.status === "email_sent" &&
      existing.emailSentAt &&
      existing.emailSentAt < sixHoursAgo &&
      Math.abs(existing.subtotal - subtotal) > existing.subtotal * 0.2

    await prisma.abandonedCart.update({
      where: { id: existing.id },
      data: {
        items: body.items,
        subtotal,
        userId,
        ...(significantChange
          ? { status: "tracked", emailSentAt: null }
          : {}),
      },
    })
    return NextResponse.json({ ok: true, id: existing.id })
  }

  const created = await prisma.abandonedCart.create({
    data: {
      email,
      userId,
      items: body.items,
      subtotal,
      recoveryToken: generateToken(24),
    },
  })

  return NextResponse.json({ ok: true, id: created.id })
}

/**
 * Клиент может отменить tracking явно (например, когда реально завершил
 * заказ и Order был создан — вызываем из createOrder success-path).
 */
export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const email = (url.searchParams.get("email") || "").trim().toLowerCase()
  if (!email) return NextResponse.json({ ok: true })

  await prisma.abandonedCart.updateMany({
    where: { email, status: { in: ["tracked", "email_sent"] } },
    data: { status: "recovered", recoveredAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
