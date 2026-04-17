import { NextResponse } from "next/server"
import { getProducts } from "@/lib/dal/products"
import { getFavoriteProductIds } from "@/lib/dal/favorites"
import { auth } from "@/lib/auth"
import type { ProductType } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 48

export async function GET(request: Request) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
  const PAGE_SIZE = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get("limit")) || DEFAULT_PAGE_SIZE))

  // Default to coffee when no ?type param — matches the catalog page default
  // so infinite-scroll load-more doesn't start pulling in tea/instant products.
  const rawType = url.searchParams.get("type")
  const productType: ProductType =
    rawType === "tea" || rawType === "instant" ? rawType : "coffee"

  const filters = {
    productType,
    roastLevel: url.searchParams.get("roast") || undefined,
    origin: url.searchParams.get("origin") || undefined,
    brewingMethod: url.searchParams.get("brewing") || undefined,
    teaType: url.searchParams.get("teaType") || undefined,
    productForm: url.searchParams.get("form") || undefined,
    collectionSlug: url.searchParams.get("collection") || undefined,
    search: url.searchParams.get("q") || undefined,
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
