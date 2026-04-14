import { NextResponse } from "next/server"
import { getProducts } from "@/lib/dal/products"
import { getFavoriteProductIds } from "@/lib/dal/favorites"
import { auth } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PAGE_SIZE = 12

export async function GET(request: Request) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)

  const filters = {
    roastLevel: url.searchParams.get("roast") || undefined,
    origin: url.searchParams.get("origin") || undefined,
    brewingMethod: url.searchParams.get("brewing") || undefined,
    collectionSlug: url.searchParams.get("collection") || undefined,
    sort: (url.searchParams.get("sort") as "price-asc" | "price-desc" | "newest" | "popular" | undefined) ?? undefined,
    page,
    limit: PAGE_SIZE,
  }

  const session = await auth()
  const isCustomer = (session?.user as Record<string, unknown>)?.userType === "customer"

  const [{ products, total }, favIds] = await Promise.all([
    getProducts(filters),
    isCustomer && session?.user?.id
      ? getFavoriteProductIds(session.user.id)
      : Promise.resolve([]),
  ])

  const hasMore = page * PAGE_SIZE < total

  return NextResponse.json({
    products,
    total,
    hasMore,
    page,
    favoriteIds: isCustomer ? favIds : null,
  })
}
