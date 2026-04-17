import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import {
  scoreProducts,
  pickTopMatches,
  reasonsForMatch,
  type ScorableProduct,
} from "@/components/home/quiz/scoring"
import type { Answers } from "@/components/home/quiz/questions"
import type { ProductCard } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ALLOWED_ANSWERS: Record<keyof Answers, Set<string>> = {
  milk: new Set(["milk", "black", "both"]),
  flavor: new Set(["chocolate", "balanced", "fruity", "any"]),
  acidity: new Set(["low", "mid", "high"]),
  brewing: new Set(["espresso", "turka", "filter", "french-press", "any"]),
  experience: new Set(["beginner", "regular", "enthusiast"]),
}

function sanitizeAnswers(raw: unknown): Answers {
  if (typeof raw !== "object" || raw === null) return {}
  const input = raw as Record<string, unknown>
  const out: Answers = {}
  for (const key of Object.keys(ALLOWED_ANSWERS) as (keyof Answers)[]) {
    const value = input[key]
    if (typeof value === "string" && ALLOWED_ANSWERS[key].has(value)) {
      out[key] = value
    }
  }
  return out
}

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const body = sanitizeAnswers(raw)

  const products = await prisma.product.findMany({
    where: { isActive: true, productType: "coffee" },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      variants: { where: { isActive: true }, orderBy: { price: "asc" } },
      reviews: { where: { isVisible: true }, select: { rating: true } },
      collections: { select: { collection: { select: { slug: true } } } },
    },
  })

  if (products.length === 0) {
    return NextResponse.json({ products: [], matches: [] })
  }

  const scorable: ScorableProduct[] = products.map((p) => {
    const reviewCount = p.reviews.length
    const averageRating =
      reviewCount > 0
        ? Math.round((p.reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10
        : null
    return {
      id: p.id,
      collectionSlugs: p.collections.map((ci) => ci.collection.slug),
      brewingMethods: p.brewingMethods,
      reviewCount,
      averageRating,
    }
  })

  const scored = scoreProducts(scorable, body)
  const picks = pickTopMatches(scored, 3)
  const topIds = picks.map((s) => s.productId)
  const matchMap = new Map(picks.map((s) => [s.productId, s]))

  const byId = new Map(products.map((p) => [p.id, p]))
  const topProducts: ProductCard[] = topIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      productType: p.productType as ProductCard["productType"],
      productForm: p.productForm,
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

  const matches = topProducts.map((p) => {
    const s = matchMap.get(p.id)
    return {
      productId: p.id,
      percent: s?.percent ?? 50,
      reasons: s ? reasonsForMatch(s.matchedCollections) : [],
    }
  })

  return NextResponse.json({ products: topProducts, matches })
}
