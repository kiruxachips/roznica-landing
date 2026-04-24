import { prisma } from "@/lib/prisma"

/**
 * Pricing engine для оптового кабинета.
 *
 * Millor Coffee использует tier-скидку от ОБЩЕГО веса корзины:
 *   6 кг  → 3%
 *   15 кг → 5%
 *   30 кг → 9%
 *   60 кг → 20%
 *
 * Эта скидка применяется ко всей корзине СРАЗУ, не к отдельным позициям.
 * Поэтому в оптовом каталоге цены показываются розничные (+ индикатор «от 6кг
 * скидка 3%»), а на checkout считается фактический discount от actual веса.
 *
 * Старые схемы (fixed-item и discount_pct) оставлены для совместимости —
 * они работают через resolvePrice, но дефолт для новых прайс-листов —
 * weight_tier.
 */

export interface PriceContext {
  channel: "retail" | "wholesale"
  priceListId?: string | null
  companyId?: string
}

export interface ResolvedPrice {
  price: number
  oldPrice: number | null
  discountPct: number | null
  minQuantity: number
  source:
    | "retail"
    | "pricelist_item"
    | "pricelist_discount"
    | "retail_fallback"
    | "weight_tier_base"
}

export const RETAIL_CONTEXT: PriceContext = { channel: "retail" }

function retailResolve(variant: {
  price: number
  oldPrice: number | null
}): ResolvedPrice {
  const discountPct =
    variant.oldPrice && variant.oldPrice > variant.price
      ? Math.round(((variant.oldPrice - variant.price) / variant.oldPrice) * 100)
      : null
  return {
    price: variant.price,
    oldPrice: variant.oldPrice,
    discountPct,
    minQuantity: 1,
    source: "retail",
  }
}

export async function resolvePrice(
  variantId: string,
  ctx: PriceContext = RETAIL_CONTEXT
): Promise<ResolvedPrice | null> {
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, price: true, oldPrice: true, wholesaleMinQuantity: true },
  })
  if (!variant) return null

  if (ctx.channel === "retail" || !ctx.priceListId) {
    return retailResolve(variant)
  }

  const priceList = await prisma.priceList.findUnique({
    where: { id: ctx.priceListId },
    select: { id: true, isActive: true, kind: true, discountPct: true },
  })
  if (!priceList || !priceList.isActive) {
    return retailResolve(variant)
  }

  // weight_tier — цены на карточке показываем розничные. Фактическая скидка
  // применяется в корзине. Но помечаем как "weight_tier_base" чтобы UI знал
  // что есть тиры (показать индикатор).
  if (priceList.kind === "weight_tier") {
    return {
      ...retailResolve(variant),
      minQuantity: variant.wholesaleMinQuantity ?? 1,
      source: "weight_tier_base",
    }
  }

  // Legacy: item-override для fixed/discount_pct
  const item = await prisma.priceListItem.findFirst({
    where: { priceListId: ctx.priceListId, variantId, minQuantity: 1 },
    select: { price: true, minQuantity: true },
  })

  if (item) {
    return {
      price: item.price,
      oldPrice: variant.price > item.price ? variant.price : null,
      discountPct:
        variant.price > item.price
          ? Math.round(((variant.price - item.price) / variant.price) * 100)
          : null,
      minQuantity: Math.max(item.minQuantity, variant.wholesaleMinQuantity ?? 1),
      source: "pricelist_item",
    }
  }

  if (
    priceList.kind === "discount_pct" &&
    priceList.discountPct &&
    priceList.discountPct > 0
  ) {
    const price = Math.round(variant.price * (1 - priceList.discountPct / 100))
    return {
      price,
      oldPrice: variant.price,
      discountPct: priceList.discountPct,
      minQuantity: variant.wholesaleMinQuantity ?? 1,
      source: "pricelist_discount",
    }
  }

  return { ...retailResolve(variant), source: "retail_fallback" }
}

export async function resolvePrices(
  variantIds: string[],
  ctx: PriceContext = RETAIL_CONTEXT
): Promise<Map<string, ResolvedPrice>> {
  const result = new Map<string, ResolvedPrice>()
  if (variantIds.length === 0) return result

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, price: true, oldPrice: true, wholesaleMinQuantity: true },
  })

  if (ctx.channel === "retail" || !ctx.priceListId) {
    for (const v of variants) {
      result.set(v.id, retailResolve(v))
    }
    return result
  }

  const priceList = await prisma.priceList.findUnique({
    where: { id: ctx.priceListId },
    select: { id: true, isActive: true, kind: true, discountPct: true },
  })

  if (!priceList || !priceList.isActive) {
    for (const v of variants) {
      result.set(v.id, retailResolve(v))
    }
    return result
  }

  if (priceList.kind === "weight_tier") {
    for (const v of variants) {
      result.set(v.id, {
        ...retailResolve(v),
        minQuantity: v.wholesaleMinQuantity ?? 1,
        source: "weight_tier_base",
      })
    }
    return result
  }

  const items = await prisma.priceListItem.findMany({
    where: {
      priceListId: ctx.priceListId,
      variantId: { in: variantIds },
      minQuantity: 1,
    },
    select: { variantId: true, price: true, minQuantity: true },
  })
  const byVariant = new Map(items.map((i) => [i.variantId, i]))

  for (const v of variants) {
    const item = byVariant.get(v.id)
    if (item) {
      result.set(v.id, {
        price: item.price,
        oldPrice: v.price > item.price ? v.price : null,
        discountPct:
          v.price > item.price
            ? Math.round(((v.price - item.price) / v.price) * 100)
            : null,
        minQuantity: Math.max(item.minQuantity, v.wholesaleMinQuantity ?? 1),
        source: "pricelist_item",
      })
      continue
    }
    if (
      priceList.kind === "discount_pct" &&
      priceList.discountPct &&
      priceList.discountPct > 0
    ) {
      const price = Math.round(v.price * (1 - priceList.discountPct / 100))
      result.set(v.id, {
        price,
        oldPrice: v.price,
        discountPct: priceList.discountPct,
        minQuantity: v.wholesaleMinQuantity ?? 1,
        source: "pricelist_discount",
      })
      continue
    }
    result.set(v.id, { ...retailResolve(v), source: "retail_fallback" })
  }

  return result
}

// ── Weight tier discount ──────────────────────────────────────────────

export interface WeightTier {
  minWeightGrams: number
  discountPct: number
}

/**
 * Возвращает тиры прайс-листа (отсортированы по весу ASC).
 * Для прайс-листа не-weight_tier возвращает пустой массив.
 */
export async function getWeightTiers(priceListId: string): Promise<WeightTier[]> {
  const priceList = await prisma.priceList.findUnique({
    where: { id: priceListId },
    select: { kind: true, isActive: true },
  })
  if (!priceList || !priceList.isActive || priceList.kind !== "weight_tier") return []
  return prisma.priceListWeightTier.findMany({
    where: { priceListId },
    orderBy: { minWeightGrams: "asc" },
    select: { minWeightGrams: true, discountPct: true },
  })
}

export interface TierDiscount {
  applied: WeightTier | null
  next: WeightTier | null
  remainingGramsToNext: number | null
  discountPct: number
}

/**
 * По общему весу корзины (гр) возвращает активный тир + следующий.
 * applied === null если ни один тир ещё не достигнут.
 */
export function pickTier(
  tiers: WeightTier[],
  totalWeightGrams: number
): TierDiscount {
  if (tiers.length === 0) {
    return { applied: null, next: null, remainingGramsToNext: null, discountPct: 0 }
  }
  const sorted = [...tiers].sort((a, b) => a.minWeightGrams - b.minWeightGrams)
  let applied: WeightTier | null = null
  let next: WeightTier | null = null
  for (const t of sorted) {
    if (totalWeightGrams >= t.minWeightGrams) {
      applied = t
    } else {
      next = t
      break
    }
  }
  return {
    applied,
    next,
    remainingGramsToNext: next ? next.minWeightGrams - totalWeightGrams : null,
    discountPct: applied?.discountPct ?? 0,
  }
}

/**
 * Асинхронная версия: загружает тиры и считает discount по весу.
 */
export async function resolveTierDiscount(
  priceListId: string | null | undefined,
  totalWeightGrams: number
): Promise<TierDiscount> {
  if (!priceListId) {
    return { applied: null, next: null, remainingGramsToNext: null, discountPct: 0 }
  }
  const tiers = await getWeightTiers(priceListId)
  return pickTier(tiers, totalWeightGrams)
}

/**
 * Парсит строку веса (250г, 1кг, 500g, 2.5кг) в граммы. 0 если не распознали.
 */
export function parseWeightGrams(w: string): number {
  const lower = w.toLowerCase().trim()
  const m = lower.match(/^([\d.,]+)\s*(кг|г|kg|g)?$/)
  if (!m) return 0
  const n = parseFloat(m[1].replace(",", "."))
  if (isNaN(n)) return 0
  const unit = m[2] || "г"
  return unit === "кг" || unit === "kg" ? Math.round(n * 1000) : Math.round(n)
}
