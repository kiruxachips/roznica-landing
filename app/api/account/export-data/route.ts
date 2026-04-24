import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/account/export-data
 *
 * Возвращает JSON со всеми ПД текущего юзера. Требование 152-ФЗ
 * «право на получение данных об обрабатываемой информации».
 *
 * Что включается:
 *   - Профиль (email/name/phone/addresses)
 *   - История заказов (с items, status, datetime)
 *   - Бонусные транзакции
 *   - Согласия на обработку ПД (audit-trail)
 *   - Избранные товары
 *
 * Что НЕ включается:
 *   - Пароль и токены (безопасность)
 *   - OAuth refresh-token'ы
 *   - Admin-заметки о заказе (внутренняя информация)
 */
export async function GET() {
  const session = await auth()
  const userId = session?.user?.id
  const userType = (session?.user as Record<string, unknown> | undefined)?.userType

  if (!userId || userType !== "customer") {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }

  const [user, orders, bonuses, consents, favorites, addresses] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        image: true,
        avatarUrl: true,
        defaultAddress: true,
        telegramId: true,
        notifyOrderStatus: true,
        notifyPromotions: true,
        notifyNewProducts: true,
        bonusBalance: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.order.findMany({
      where: { userId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        total: true,
        subtotal: true,
        deliveryPrice: true,
        deliveryAddress: true,
        deliveryMethod: true,
        deliveryType: true,
        pickupPointName: true,
        destinationCity: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        notes: true,
        bonusUsed: true,
        bonusEarned: true,
        promoCode: { select: { code: true } },
        items: {
          select: {
            name: true,
            weight: true,
            price: true,
            quantity: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.bonusTransaction.findMany({
      where: { userId },
      select: {
        amount: true,
        type: true,
        description: true,
        orderId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.userConsent.findMany({
      where: { userId },
      select: {
        type: true,
        version: true,
        source: true,
        acceptedAt: true,
        revokedAt: true,
        ipAddress: true,
      },
      orderBy: { acceptedAt: "desc" },
    }),
    prisma.favorite.findMany({
      where: { userId },
      select: {
        product: { select: { slug: true, name: true } },
        createdAt: true,
      },
    }),
    prisma.address.findMany({
      where: { userId },
      select: {
        title: true,
        fullAddress: true,
        recipientName: true,
        recipientPhone: true,
        isDefault: true,
        createdAt: true,
      },
    }),
  ])

  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 })
  }

  const exportData = {
    generatedAt: new Date().toISOString(),
    exportVersion: 1,
    legalBasis:
      "152-ФЗ ст. 14: право субъекта ПД на получение информации об обрабатываемых персональных данных",
    contact: "privacy@millor-coffee.ru",
    user,
    orders,
    bonuses,
    consents,
    favorites,
    addresses,
  }

  const filename = `millor-account-${userId}-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
