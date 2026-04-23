import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withRateLimit, DELIVERY_RATE_LIMIT } from "@/lib/api-helpers"
import { areGiftsEnabled } from "@/lib/dal/gifts"

/**
 * Возвращает ближайший ещё-недостигнутый gift-порог — используется
 * мотивационной подсказкой на checkout «Добавьте ещё 500₽ — получите подарок».
 * Логика: первый активный Gift c minCartTotal > cartTotal (и stock > 0 или null).
 * Отсортировано по возрастанию порога, берём ближайший.
 */
export const GET = withRateLimit(async (request: NextRequest) => {
  // Kill-switch — программа выключена админом, прячем мотивационный UI
  if (!(await areGiftsEnabled())) {
    return NextResponse.json({ next: null })
  }

  const cartTotalRaw = request.nextUrl.searchParams.get("cartTotal")
  const cartTotal = Math.max(0, parseInt(cartTotalRaw || "0", 10) || 0)

  const next = await prisma.gift.findFirst({
    where: {
      isActive: true,
      minCartTotal: { gt: cartTotal },
      OR: [{ stock: null }, { stock: { gt: 0 } }],
    },
    orderBy: { minCartTotal: "asc" },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      imageAlt: true,
      minCartTotal: true,
    },
  })

  return NextResponse.json({
    next: next
      ? {
          giftId: next.id,
          name: next.name,
          imageUrl: next.imageUrl,
          imageAlt: next.imageAlt,
          minCartTotal: next.minCartTotal,
          addMore: next.minCartTotal - cartTotal,
        }
      : null,
  })
}, { ...DELIVERY_RATE_LIMIT, tag: "gifts-next-threshold" })
