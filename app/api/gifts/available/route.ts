import { NextRequest, NextResponse } from "next/server"
import { getAvailableGifts } from "@/lib/dal/gifts"
import { withRateLimit, DELIVERY_RATE_LIMIT } from "@/lib/api-helpers"

/**
 * Возвращает подарки, доступные для текущего cartTotal. Вызывается checkout'ом
 * при каждом пересчёте корзины. Кэш не ставим — доступность зависит от cartTotal.
 * Rate-limit как у delivery endpoints (60/мин/IP).
 */
export const GET = withRateLimit(async (request: NextRequest) => {
  const cartTotalRaw = request.nextUrl.searchParams.get("cartTotal")
  const cartTotal = Math.max(0, parseInt(cartTotalRaw || "0", 10) || 0)
  const gifts = await getAvailableGifts(cartTotal)
  return NextResponse.json({ gifts })
}, { ...DELIVERY_RATE_LIMIT, tag: "gifts-available" })
