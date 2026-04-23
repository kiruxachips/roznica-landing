import type { TasteProfile, RecommendedProduct, ProductType } from "./types"

interface CandidateProduct {
  id: string
  name: string
  slug: string
  primaryImage: string | null
  primaryImageAlt: string | null
  productType: ProductType
  flavorNotes: string[]
  origin: string | null
  roastLevel: string | null
  reviewCount: number
  variants: { id: string; weight: string; price: number; stock: number }[]
}

export interface CartSignals {
  cartProductIds: string[]
  cartTotal: number
  freeDeliveryThreshold: number
  giftThreshold: number
  cartFlavorNotes: string[]
  cartOrigins: string[]
  cartRoastLevels: string[]
  cartProductTypes: ProductType[]
  tasteProfile: TasteProfile | null
  maxReviews: number
}

function variantFillScore(price: number, gap: number): number {
  if (gap <= 0) return 0.3
  if (price <= 0) return 0
  if (price <= gap) return price / gap
  const overshoot = price / gap
  return Math.max(0.05, 1 - (overshoot - 1) * 0.6)
}

function pickOptimalVariant(
  variants: CandidateProduct["variants"],
  gap: number
): CandidateProduct["variants"][0] | null {
  const available = variants.filter((v) => v.stock > 0)
  if (available.length === 0) return null
  return available.reduce((best, v) =>
    variantFillScore(v.price, gap) >= variantFillScore(best.price, gap) ? v : best
  , available[0])
}

function computeAffinity(product: CandidateProduct, signals: CartSignals): number {
  let score = 0

  // Cross-sell: if cart has only one product type, other types get a bonus
  const uniqueCartTypes = new Set(signals.cartProductTypes)
  if (uniqueCartTypes.size === 1 && !uniqueCartTypes.has(product.productType)) {
    score += 0.25
  }

  // Flavor note overlap with current cart
  if (product.flavorNotes.length > 0 && signals.cartFlavorNotes.length > 0) {
    const overlap = product.flavorNotes.filter((n) => signals.cartFlavorNotes.includes(n)).length
    const denom = Math.max(product.flavorNotes.length, signals.cartFlavorNotes.length)
    score += (overlap / denom) * 0.40
  }

  // Flavor note overlap with purchase history
  if (signals.tasteProfile && product.flavorNotes.length > 0) {
    const profileNotes = Object.keys(signals.tasteProfile.flavorNotes)
    const overlap = product.flavorNotes.filter((n) => profileNotes.includes(n)).length
    const denom = Math.max(product.flavorNotes.length, profileNotes.length)
    if (denom > 0) score += (overlap / denom) * 0.20
  }

  // Origin match with cart
  if (product.origin && signals.cartOrigins.includes(product.origin)) score += 0.15

  // Roast level match with cart
  if (product.roastLevel && signals.cartRoastLevels.includes(product.roastLevel)) score += 0.15

  return Math.min(1, score)
}

function detectReason(
  product: CandidateProduct,
  fScore: number,
  aScore: number,
  signals: CartSignals
): RecommendedProduct["reason"] {
  const uniqueCartTypes = new Set(signals.cartProductTypes)
  if (uniqueCartTypes.size === 1 && !uniqueCartTypes.has(product.productType)) return "cross-sell"

  // Разделяем два milestone-кейса: ДО бесплатной доставки и ДО подарка.
  // Раньше reason был общий "milestone", и UI врал про "До бесплатной доставки"
  // когда юзер уже её достиг, но ещё не набрал на подарок.
  const needsFreeDelivery =
    signals.freeDeliveryThreshold > 0 && signals.cartTotal < signals.freeDeliveryThreshold
  const needsGift =
    signals.giftThreshold > 0 && signals.cartTotal < signals.giftThreshold

  if (needsFreeDelivery && fScore >= 0.55) return "milestone_free_delivery"
  if (needsGift && fScore >= 0.55) return "milestone_gift"
  if (aScore >= 0.30) return "affinity"
  return "popular"
}

export function scoreProducts(
  candidates: CandidateProduct[],
  signals: CartSignals,
  limit = 3
): RecommendedProduct[] {
  const nextMilestone =
    signals.freeDeliveryThreshold > 0 && signals.cartTotal < signals.freeDeliveryThreshold
      ? signals.freeDeliveryThreshold
      : signals.giftThreshold > 0 && signals.cartTotal < signals.giftThreshold
      ? signals.giftThreshold
      : 0

  const gap = nextMilestone > 0 ? nextMilestone - signals.cartTotal : 0

  return candidates
    .filter((p) => !signals.cartProductIds.includes(p.id))
    .map((p) => {
      const variant = pickOptimalVariant(p.variants, gap)
      if (!variant) return null

      const fScore = variantFillScore(variant.price, gap)
      const aScore = computeAffinity(p, signals)
      const pScore = signals.maxReviews > 0 ? Math.min(1, p.reviewCount / signals.maxReviews) : 0
      const nScore = signals.tasteProfile?.purchasedProductIds.includes(p.id) ? 0 : 1

      const total = fScore * 0.40 + aScore * 0.35 + pScore * 0.15 + nScore * 0.10

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        primaryImage: p.primaryImage,
        primaryImageAlt: p.primaryImageAlt,
        productType: p.productType,
        recommendedVariant: variant,
        score: total,
        reason: detectReason(p, fScore, aScore, signals),
      } satisfies RecommendedProduct
    })
    .filter((x): x is RecommendedProduct => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
