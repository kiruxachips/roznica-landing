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

/**
 * Сценарий замены: товар закончился / снят с продажи. Цель — предложить
 * максимально близкий по вкусовому профилю и цене аналог. Это НЕ milestone-
 * upsell (gap до бесплатной доставки тут не фактор), поэтому формула другая
 * чем в scoreProducts.
 *
 * Hard-фильтры:
 *  - сам заменяемый товар исключён;
 *  - тот же productType (кофе ↔ кофе, чай ↔ чай — не предлагаем чай взамен
 *    кофе, иначе UX странный);
 *  - есть фасовка в наличии.
 *
 * Soft-score (нормирован 0..1):
 *  - affinity (flavor / origin / roast / tasteProfile match) — 0.55
 *  - priceProximity к target.price — 0.35
 *  - popularity (reviewCount) — 0.10
 *
 * Из вариантов товара выбирается фасовка с ценой ближе всего к target.price —
 * чтобы UX-обещание «не сильно отличается по цене» сработало.
 */
export interface ReplacementTarget {
  variantId: string
  productId: string
  productType: ProductType
  flavorNotes: string[]
  origin: string | null
  roastLevel: string | null
  price: number
  tasteProfile: TasteProfile | null
  maxReviews: number
}

function pickClosestPriceVariant(
  variants: CandidateProduct["variants"],
  targetPrice: number
): CandidateProduct["variants"][0] | null {
  const available = variants.filter((v) => v.stock > 0)
  if (available.length === 0) return null
  return available.reduce((best, v) =>
    Math.abs(v.price - targetPrice) < Math.abs(best.price - targetPrice) ? v : best
  , available[0])
}

export function scoreReplacements(
  candidates: CandidateProduct[],
  target: ReplacementTarget,
  limit = 3
): RecommendedProduct[] {
  // Переиспользуем computeAffinity, упаковав target как «псевдо-сигналы корзины»
  // из одного товара. Это держит логику flavor/origin/roast в одном месте.
  const signalsForAffinity: CartSignals = {
    cartProductIds: [target.productId],
    cartTotal: 0,
    freeDeliveryThreshold: 0,
    giftThreshold: 0,
    cartFlavorNotes: target.flavorNotes,
    cartOrigins: target.origin ? [target.origin] : [],
    cartRoastLevels: target.roastLevel ? [target.roastLevel] : [],
    cartProductTypes: [target.productType],
    tasteProfile: target.tasteProfile,
    maxReviews: target.maxReviews,
  }

  return candidates
    .filter((p) => p.id !== target.productId)
    .filter((p) => p.productType === target.productType)
    .map((p): RecommendedProduct | null => {
      const variant = pickClosestPriceVariant(p.variants, target.price)
      if (!variant) return null

      // Affinity без cross-sell бонуса (тот же productType всегда — он бы дал
      // false-positive). Считаем напрямую через signal-overlap.
      const aScore = computeAffinity(p, signalsForAffinity)
      // priceProximity: 1 при равной цене, 0 при разнице ≥ targetPrice.
      const priceDiff = Math.abs(variant.price - target.price)
      const pxScore =
        target.price > 0 ? Math.max(0, 1 - priceDiff / target.price) : 0
      const popScore =
        target.maxReviews > 0 ? Math.min(1, p.reviewCount / target.maxReviews) : 0

      const total = aScore * 0.55 + pxScore * 0.35 + popScore * 0.1

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        primaryImage: p.primaryImage,
        primaryImageAlt: p.primaryImageAlt,
        productType: p.productType,
        recommendedVariant: variant,
        score: total,
        reason: "replacement",
        priceDelta: variant.price - target.price,
      }
    })
    .filter((x): x is RecommendedProduct => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
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
