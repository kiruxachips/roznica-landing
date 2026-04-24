import { prisma } from "@/lib/prisma"
import {
  parseWeightGrams,
  resolvePrice,
  resolvePrices,
  type PriceContext,
  type ResolvedPrice,
} from "@/lib/dal/pricing"
import type { ProductType } from "@/lib/types"

/**
 * Оптовый каталог. Использует ТОЛЬКО resolvePrices — никогда не читает
 * variant.price напрямую. Выводит продукты с ценами из прайс-листа
 * компании-клиента.
 */

export interface WholesaleProductCardVariant {
  id: string
  weight: string
  stock: number
  minQuantity: number
  price: number
  oldPrice: number | null
  discountPct: number | null
}

export interface WholesaleProductCard {
  id: string
  name: string
  slug: string
  description: string
  productType: ProductType
  productForm: string | null
  origin: string | null
  roastLevel: string | null
  badge: string | null
  flavorNotes: string[]
  primaryImage: string | null
  primaryImageAlt: string | null
  smallImage: string | null
  minPrice: number | null
  variants: WholesaleProductCardVariant[]
}

export interface WholesaleProductDetail extends WholesaleProductCard {
  fullDescription: string | null
  region: string | null
  farm: string | null
  altitude: string | null
  processingMethod: string | null
  brewingMethods: string[]
  acidity: number | null
  sweetness: number | null
  bitterness: number | null
  body: number | null
  images: { url: string; alt: string | null }[]
}

// В оптовом каталоге показываем только кофе ровно по 1кг. Всё остальное
// (чай, растворимка, цикорий, 250г/500г-пачки) — розничный ассортимент,
// опт с ним не работает. Единая точка парсинга веса — parseWeightGrams
// из pricing.ts: покрывает "1кг", "1 кг", "1КГ", "1000г", "1,0кг", "1.0kg" и т.д.
function isWholesaleCoffeeKg(weight: string): boolean {
  return parseWeightGrams(weight) === 1000
}

export async function getWholesaleCatalog(ctx: PriceContext): Promise<WholesaleProductCard[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true, productType: "coffee" },
    orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      productType: true,
      productForm: true,
      origin: true,
      roastLevel: true,
      badge: true,
      flavorNotes: true,
      smallImage: true,
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { url: true, alt: true },
      },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, weight: true, stock: true, wholesaleMinQuantity: true },
      },
    },
  })

  const allVariantIds = products.flatMap((p) =>
    p.variants.filter((v) => isWholesaleCoffeeKg(v.weight)).map((v) => v.id)
  )
  const priceMap = await resolvePrices(allVariantIds, ctx)

  return products
    .map((p) => {
      const variants: WholesaleProductCardVariant[] = p.variants
        .filter((v) => isWholesaleCoffeeKg(v.weight))
        .map((v) => {
          const priced = priceMap.get(v.id)
          if (!priced) return null
          return {
            id: v.id,
            weight: v.weight,
            stock: v.stock,
            minQuantity: Math.max(priced.minQuantity, v.wholesaleMinQuantity ?? 1),
            price: priced.price,
            oldPrice: priced.oldPrice,
            discountPct: priced.discountPct,
          }
        })
        .filter((v): v is WholesaleProductCardVariant => v !== null)
        .sort((a, b) => a.price - b.price)

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        productType: p.productType as ProductType,
        productForm: p.productForm,
        origin: p.origin,
        roastLevel: p.roastLevel,
        badge: p.badge,
        flavorNotes: p.flavorNotes,
        primaryImage: p.images[0]?.url ?? null,
        primaryImageAlt: p.images[0]?.alt ?? null,
        smallImage: p.smallImage,
        minPrice: variants[0]?.price ?? null,
        variants,
      }
    })
    .filter((p) => p.variants.length > 0)
}

export async function getWholesaleProductBySlug(
  slug: string,
  ctx: PriceContext
): Promise<WholesaleProductDetail | null> {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      fullDescription: true,
      isActive: true,
      productType: true,
      productForm: true,
      origin: true,
      region: true,
      farm: true,
      altitude: true,
      roastLevel: true,
      processingMethod: true,
      flavorNotes: true,
      brewingMethods: true,
      acidity: true,
      sweetness: true,
      bitterness: true,
      body: true,
      badge: true,
      smallImage: true,
      images: {
        orderBy: { sortOrder: "asc" },
        select: { url: true, alt: true, isPrimary: true },
      },
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, weight: true, stock: true, wholesaleMinQuantity: true },
      },
    },
  })

  if (!product || !product.isActive || product.productType !== "coffee") return null

  // В опте только 1кг кофе — 250г и прочее режем.
  const coffeeKgVariants = product.variants.filter((v) => isWholesaleCoffeeKg(v.weight))
  const priceMap = await resolvePrices(
    coffeeKgVariants.map((v) => v.id),
    ctx
  )

  const variants: WholesaleProductCardVariant[] = coffeeKgVariants
    .map((v) => {
      const priced = priceMap.get(v.id)
      if (!priced) return null
      return {
        id: v.id,
        weight: v.weight,
        stock: v.stock,
        minQuantity: Math.max(priced.minQuantity, v.wholesaleMinQuantity ?? 1),
        price: priced.price,
        oldPrice: priced.oldPrice,
        discountPct: priced.discountPct,
      }
    })
    .filter((v): v is WholesaleProductCardVariant => v !== null)
    .sort((a, b) => a.price - b.price)

  if (variants.length === 0) return null

  const primaryImage = product.images.find((i) => i.isPrimary) ?? product.images[0]

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    fullDescription: product.fullDescription,
    productType: product.productType as ProductType,
    productForm: product.productForm,
    origin: product.origin,
    region: product.region,
    farm: product.farm,
    altitude: product.altitude,
    roastLevel: product.roastLevel,
    processingMethod: product.processingMethod,
    flavorNotes: product.flavorNotes,
    brewingMethods: product.brewingMethods,
    acidity: product.acidity,
    sweetness: product.sweetness,
    bitterness: product.bitterness,
    body: product.body,
    badge: product.badge,
    smallImage: product.smallImage,
    primaryImage: primaryImage?.url ?? null,
    primaryImageAlt: primaryImage?.alt ?? null,
    images: product.images.map((i) => ({ url: i.url, alt: i.alt })),
    minPrice: variants[0]!.price,
    variants,
  }
}

/**
 * Для refresh корзины — даёт цены по списку variantId за один запрос.
 */
export async function getVariantPricesForRefresh(
  variantIds: string[],
  ctx: PriceContext
): Promise<Map<string, { price: number; stock: number; minQuantity: number; name: string; weight: string; slug: string; image: string | null }>> {
  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: variantIds },
      isActive: true,
      product: { isActive: true, productType: "coffee" },
    },
    select: {
      id: true,
      weight: true,
      stock: true,
      wholesaleMinQuantity: true,
      product: {
        select: {
          name: true,
          slug: true,
          isActive: true,
          productType: true,
          smallImage: true,
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { url: true },
          },
        },
      },
    },
  })

  const priceMap = await resolvePrices(variantIds, ctx)
  const result = new Map<string, {
    price: number
    stock: number
    minQuantity: number
    name: string
    weight: string
    slug: string
    image: string | null
  }>()

  for (const v of variants) {
    if (!v.product.isActive) continue
    if (!isWholesaleCoffeeKg(v.weight)) continue
    const p = priceMap.get(v.id)
    if (!p) continue
    result.set(v.id, {
      price: p.price,
      stock: v.stock,
      minQuantity: Math.max(p.minQuantity, v.wholesaleMinQuantity ?? 1),
      name: v.product.name,
      weight: v.weight,
      slug: v.product.slug,
      image: v.product.images[0]?.url ?? v.product.smallImage ?? null,
    })
  }

  return result
}

export { resolvePrice } from "@/lib/dal/pricing"
