import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { scoreReplacements } from "@/lib/recommendations"
import { unstable_cache } from "next/cache"
import { CACHE_TAGS } from "@/lib/cache-tags"
import type { TasteProfile, ProductType } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// C6: zod-валидация. Раньше любая строка проходила как variantId — это
// открывало кэш-флуд (GET /api/cart/replacements?variantId=<рандомное>
// заполнял query-кэш мусором) и облегчало scrape ассортимента. cuid()
// у Prisma — стандарт, длина 25, [a-z0-9]. Длина limit — 1..6.
const BodySchema = z.object({
  variantId: z
    .string()
    .min(20)
    .max(40)
    .regex(/^[a-z0-9]+$/, "invalid id"),
  limit: z.number().int().min(1).max(6).optional(),
})

// Тот же запрос как в /api/cart/recommendations — переиспользуем кэш-ключ.
// Ленивая выборка active-товаров с вариантами и счётом отзывов.
const getAllProductsForRecommendations = unstable_cache(
  () =>
    prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        productType: true,
        flavorNotes: true,
        origin: true,
        roastLevel: true,
        images: { where: { isPrimary: true }, take: 1, select: { url: true, alt: true } },
        variants: {
          where: { isActive: true },
          select: { id: true, weight: true, price: true, stock: true },
        },
        _count: { select: { reviews: { where: { isVisible: true } } } },
      },
    }),
  ["recommendations-all-products"],
  { revalidate: 600, tags: [CACHE_TAGS.products] }
)

export async function POST(request: Request) {
  let parsed: z.infer<typeof BodySchema>
  try {
    parsed = BodySchema.parse(await request.json())
  } catch {
    // Не leak'аем структуру схемы — просто 400.
    return NextResponse.json(
      { error: "invalid request" },
      { status: 400 }
    )
  }
  const variantId = parsed.variantId
  const limit = parsed.limit ?? 3

  // Тянем target и список всех кандидатов параллельно, чтобы не ждать
  // лишний RTT — оба запроса нужны в любом случае.
  const session = await auth()
  const userId =
    session?.user?.id && (session.user as Record<string, unknown>).userType === "customer"
      ? session.user.id
      : null

  const [targetVariant, allProducts, userData] = await Promise.all([
    prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        price: true,
        product: {
          select: {
            id: true,
            productType: true,
            flavorNotes: true,
            origin: true,
            roastLevel: true,
          },
        },
      },
    }),
    getAllProductsForRecommendations(),
    userId
      ? prisma.user.findUnique({ where: { id: userId }, select: { tasteProfile: true } })
      : Promise.resolve(null),
  ])

  if (!targetVariant) return NextResponse.json({ replacements: [] })

  const maxReviews = Math.max(1, ...allProducts.map((p) => p._count.reviews))

  const candidates = allProducts.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    primaryImage: p.images[0]?.url ?? null,
    primaryImageAlt: p.images[0]?.alt ?? null,
    productType: p.productType as ProductType,
    flavorNotes: p.flavorNotes,
    origin: p.origin,
    roastLevel: p.roastLevel,
    reviewCount: p._count.reviews,
    variants: p.variants,
  }))

  const replacements = scoreReplacements(
    candidates,
    {
      variantId: targetVariant.id,
      productId: targetVariant.product.id,
      productType: targetVariant.product.productType as ProductType,
      flavorNotes: targetVariant.product.flavorNotes,
      origin: targetVariant.product.origin,
      roastLevel: targetVariant.product.roastLevel,
      price: targetVariant.price,
      tasteProfile: (userData?.tasteProfile as unknown as TasteProfile) ?? null,
      maxReviews,
    },
    limit
  )

  return NextResponse.json(
    { replacements },
    { headers: { "Cache-Control": "private, max-age=30" } }
  )
}
