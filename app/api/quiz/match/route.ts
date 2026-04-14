import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { scoreProducts, type ScorableProduct } from "@/components/home/quiz/scoring"
import type { Answers } from "@/components/home/quiz/questions"
import type { ProductCard } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: Answers
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // Fetch active products with scorable fields + display data
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      variants: { where: { isActive: true }, orderBy: { price: "asc" } },
      reviews: { where: { isVisible: true }, select: { rating: true } },
    },
  })

  if (products.length === 0) {
    return NextResponse.json({ products: [], matches: [] })
  }

  const scorable: ScorableProduct[] = products.map((p) => ({
    id: p.id,
    flavorNotes: p.flavorNotes,
    acidity: p.acidity,
    sweetness: p.sweetness,
    bitterness: p.bitterness,
    body: p.body,
    roastLevel: p.roastLevel,
    brewingMethods: p.brewingMethods,
    minPrice: p.variants[0]?.price ?? null,
  }))

  const scored = scoreProducts(scorable, body)
  const topIds = scored.slice(0, 3).map((s) => s.productId)
  const scoreMap = new Map(scored.map((s) => [s.productId, s.score]))

  const byId = new Map(products.map((p) => [p.id, p]))
  const top: ProductCard[] = topIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      origin: p.origin,
      roastLevel: p.roastLevel,
      badge: p.badge,
      flavorNotes: p.flavorNotes,
      primaryImage: p.images[0]?.url ?? null,
      primaryImageAlt: p.images[0]?.alt ?? null,
      minPrice: p.variants[0]?.price ?? null,
      minOldPrice: p.variants[0]?.oldPrice ?? null,
      firstVariant: p.variants[0]
        ? {
            id: p.variants[0].id,
            weight: p.variants[0].weight,
            price: p.variants[0].price,
            oldPrice: p.variants[0].oldPrice,
            stock: p.variants[0].stock,
          }
        : null,
      variants: p.variants.map((v) => ({
        id: v.id,
        weight: v.weight,
        price: v.price,
        oldPrice: v.oldPrice,
        stock: v.stock,
      })),
      reviewCount: p.reviews.length,
      averageRating:
        p.reviews.length > 0
          ? Math.round((p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length) * 10) / 10
          : null,
    }))

  const matches = top.map((p) => ({ productId: p.id, score: scoreMap.get(p.id) ?? 0 }))

  return NextResponse.json({ products: top, matches })
}
