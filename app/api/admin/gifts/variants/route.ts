import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-guard"
import { listVariantsForGift } from "@/lib/dal/gifts"

/**
 * GET /api/admin/gifts/variants?search=xxx
 * Возвращает варианты товаров с insights (stock, daysSinceLastSale,
 * linkedToActiveGift) — для product-picker в /admin/gifts.
 * Защищён requireAdmin("gifts.edit").
 */
export async function GET(request: NextRequest) {
  await requireAdmin("gifts.edit")
  const search = request.nextUrl.searchParams.get("search") || undefined
  const variants = await listVariantsForGift({ search, limit: 100 })
  return NextResponse.json({ variants })
}
