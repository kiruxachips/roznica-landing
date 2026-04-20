import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { scoreProducts } from "@/lib/recommendations"
import type { TasteProfile, ProductType } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  let body: { cartProductIds?: string[]; cartTotal?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ recommendations: [] })
  }

  const cartProductIds: string[] = body.cartProductIds ?? []
  const cartTotal: number = body.cartTotal ?? 0

  const session = await auth()
  const userId =
    session?.user?.id && (session.user as Record<string, unknown>).userType === "customer"
      ? session.user.id
      : null

  const [allProducts, settings, cartProductDetails, userData] = await Promise.all([
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
        reviews: { where: { isVisible: true }, select: { id: true } },
      },
    }),
    prisma.deliverySetting.findMany({
      where: { key: { in: ["free_delivery_threshold", "gift_threshold"] } },
      select: { key: true, value: true },
    }),
    cartProductIds.length > 0
      ? prisma.product.findMany({
          where: { id: { in: cartProductIds } },
          select: { flavorNotes: true, origin: true, roastLevel: true, productType: true },
        })
      : Promise.resolve([]),
    userId
      ? prisma.user.findUnique({ where: { id: userId }, select: { tasteProfile: true } })
      : Promise.resolve(null),
  ])

  const thresholdMap = Object.fromEntries(settings.map((s) => [s.key, Number(s.value) || 0]))
  const freeDeliveryThreshold = thresholdMap["free_delivery_threshold"] ?? 3000
  const giftThreshold = thresholdMap["gift_threshold"] ?? 5000

  const cartFlavorNotes = [...new Set(cartProductDetails.flatMap((p) => p.flavorNotes))]
  const cartOrigins = [...new Set(cartProductDetails.map((p) => p.origin).filter(Boolean))] as string[]
  const cartRoastLevels = [...new Set(cartProductDetails.map((p) => p.roastLevel).filter(Boolean))] as string[]
  const cartProductTypes = [...new Set(cartProductDetails.map((p) => p.productType))] as ProductType[]

  const maxReviews = Math.max(1, ...allProducts.map((p) => p.reviews.length))

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
    reviewCount: p.reviews.length,
    variants: p.variants,
  }))

  const recommendations = scoreProducts(
    candidates,
    {
      cartProductIds,
      cartTotal,
      freeDeliveryThreshold,
      giftThreshold,
      cartFlavorNotes,
      cartOrigins,
      cartRoastLevels,
      cartProductTypes,
      tasteProfile: (userData?.tasteProfile as unknown as TasteProfile) ?? null,
      maxReviews,
    },
    4
  )

  return NextResponse.json({ recommendations })
}
