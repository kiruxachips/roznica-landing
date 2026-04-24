import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import {
  getWelcomeDiscountConfig,
  isEligibleForWelcomeDiscount,
  computeWelcomeDiscount,
} from "@/lib/dal/welcome-discount"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/cart/welcome-discount?subtotal=N
 *
 * Возвращает потенциальную welcome-скидку для текущей корзины.
 * Используется на client-side чтобы показать «Скидка первого заказа: −X₽»
 * в sidebar-summary ДО оформления.
 *
 * Для гостя userId=null — возвращает скидку (guest имеет право,
 * но пометку firstOrderCompletedAt получит только если зарегистрируется).
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const subtotal = parseInt(url.searchParams.get("subtotal") || "0", 10)
  if (!subtotal || subtotal < 0) {
    return NextResponse.json({ eligible: false, discount: 0, percent: 0 })
  }

  const session = await auth()
  const userId =
    (session?.user as Record<string, unknown> | undefined)?.userType === "customer"
      ? session?.user?.id
      : null

  const [eligible, config] = await Promise.all([
    isEligibleForWelcomeDiscount(userId),
    getWelcomeDiscountConfig(),
  ])

  if (!eligible || !config.enabled) {
    return NextResponse.json({ eligible: false, discount: 0, percent: 0 })
  }

  const discount = computeWelcomeDiscount(subtotal, config)
  return NextResponse.json({
    eligible: true,
    discount,
    percent: config.percent,
    maxRub: config.maxRub,
  })
}
