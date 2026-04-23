import { prisma } from "@/lib/prisma"
import type { ProductCard, ProductDetail, ProductFilters, ProductType } from "@/lib/types"
import { Prisma } from "@prisma/client"
import { unstable_cache } from "next/cache"
import { CACHE_TAGS } from "@/lib/cache-tags"

// Shared select shape for ProductCard listings — keeps payload minimal
export const productCardSelect = {
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
    orderBy: { price: "asc" },
    select: { id: true, weight: true, price: true, oldPrice: true, stock: true },
  },
  reviews: {
    where: { isVisible: true },
    select: { rating: true },
  },
} satisfies Prisma.ProductSelect

type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>

/**
 * Единый маппер Prisma-row → ProductCard. Используется во всех точках листинга
 * (каталог, избранное, рекомендации), чтобы не терять поля типа `variants` или
 * `smallImage` в разных копиях кода.
 */
export function mapToProductCard(p: ProductCardRow): ProductCard {
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
  }
}

export async function getProducts(filters: ProductFilters = {}): Promise<{
  products: ProductCard[]
  total: number
}> {
  const { categorySlug, collectionSlug, productType, roastLevel, origin, brewingMethod, teaType, productForm, search, sort, page = 1, limit = 12 } = filters

  const where: Prisma.ProductWhereInput = {
    isActive: true,
  }

  if (productType) {
    where.productType = productType
  }
  if (teaType) {
    // teaType maps to category slug for tea subcategories — takes precedence over categorySlug
    where.category = { slug: teaType }
  } else if (categorySlug) {
    where.category = { slug: categorySlug }
  }
  if (collectionSlug) {
    where.collections = { some: { collection: { slug: collectionSlug } } }
  }
  if (roastLevel) {
    where.roastLevel = roastLevel
  }
  if (origin) {
    where.origin = origin
  }
  if (brewingMethod) {
    where.brewingMethods = { has: brewingMethod }
  }
  if (productForm) {
    where.productForm = productForm
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
      { origin: { contains: search, mode: "insensitive" } },
    ]
  }

  const isPriceSort = sort === "price-asc" || sort === "price-desc"

  let orderBy: Prisma.ProductOrderByWithRelationInput = { sortOrder: "asc" }
  if (sort === "newest") orderBy = { createdAt: "desc" }
  if (sort === "popular") orderBy = { reviews: { _count: "desc" } }

  let items
  let total: number

  if (isPriceSort) {
    // Price lives on ProductVariant, so we can't use Prisma ORDER BY directly.
    // Step 1: Get all matching product IDs with their min variant price (lightweight query).
    const [allWithPrice, count] = await Promise.all([
      prisma.product.findMany({
        where,
        select: {
          id: true,
          variants: {
            where: { isActive: true },
            select: { price: true },
            orderBy: { price: "asc" },
            take: 1,
          },
        },
      }),
      prisma.product.count({ where }),
    ])
    total = count

    // Step 2: Sort all by min price and paginate.
    allWithPrice.sort((a, b) => {
      const aPrice = a.variants[0]?.price ?? Infinity
      const bPrice = b.variants[0]?.price ?? Infinity
      return sort === "price-asc" ? aPrice - bPrice : bPrice - aPrice
    })
    const pageIds = allWithPrice
      .slice((page - 1) * limit, page * limit)
      .map((p) => p.id)

    // Step 3: Fetch full data for the current page only.
    const fullItems = await prisma.product.findMany({
      where: { id: { in: pageIds } },
      select: productCardSelect,
    })

    // Preserve sort order (Prisma IN doesn't guarantee order).
    const idOrder = new Map(pageIds.map((id, i) => [id, i]))
    fullItems.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0))
    items = fullItems
  } else {
    const [fetched, count] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        select: productCardSelect,
      }),
      prisma.product.count({ where }),
    ])
    items = fetched
    total = count
  }

  const products: ProductCard[] = items.map(mapToProductCard)

  return { products, total }
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      category: { select: { name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" } },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      reviews: {
        where: { isVisible: true },
        orderBy: { createdAt: "desc" },
      },
    },
  })

  if (!product) return null

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
    acidity: product.acidity,
    sweetness: product.sweetness,
    bitterness: product.bitterness,
    body: product.body,
    brewingMethods: product.brewingMethods,
    badge: product.badge,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    categoryId: product.categoryId,
    category: product.category,
    images: product.images.map((img) => ({
      id: img.id,
      url: img.url,
      alt: img.alt,
      isPrimary: img.isPrimary,
    })),
    variants: product.variants.map((v) => ({
      id: v.id,
      weight: v.weight,
      price: v.price,
      oldPrice: v.oldPrice,
      stock: v.stock,
    })),
    reviews: product.reviews.map((r) => ({
      id: r.id,
      name: r.name,
      text: r.text,
      rating: r.rating,
      date: r.date,
      createdAt: r.createdAt,
    })),
  }
}

async function getFeaturedProductsUncached(limit: number): Promise<ProductCard[]> {
  const items = await prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    orderBy: { sortOrder: "asc" },
    take: limit,
    select: {
      ...productCardSelect,
      variants: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, weight: true, price: true, oldPrice: true, stock: true },
      },
    },
  })

  // Featured показывает 1кг по дефолту, поэтому переопределяем firstVariant
  // после общего маппинга. `variants` (весь массив) остаётся — ProductCard
  // сам покажет селектор веса.
  return items.map((p) => {
    const card = mapToProductCard(p)
    const displayVariant = p.variants.find((v) => v.weight === "1кг") ?? p.variants[0]
    if (displayVariant) {
      card.firstVariant = {
        id: displayVariant.id,
        weight: displayVariant.weight,
        price: displayVariant.price,
        oldPrice: displayVariant.oldPrice,
        stock: displayVariant.stock,
      }
      card.minPrice = displayVariant.price
      card.minOldPrice = displayVariant.oldPrice
    }
    return card
  })
}

export async function getFeaturedProducts(limit = 3): Promise<ProductCard[]> {
  return unstable_cache(
    () => getFeaturedProductsUncached(limit),
    ["featured-products", String(limit)],
    { revalidate: 300, tags: [CACHE_TAGS.products, CACHE_TAGS.homepage] }
  )()
}

export async function getRelatedProducts(
  productId: string,
  productType: ProductType,
  categoryId: string,
  limit = 4
): Promise<ProductCard[]> {
  // Prefer same category first, fallback to same productType
  const items = await prisma.product.findMany({
    where: {
      isActive: true,
      id: { not: productId },
      OR: [{ categoryId }, { productType }],
    },
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
    take: limit,
    select: productCardSelect,
  })

  return items.map(mapToProductCard)
}

export const getProductSlugs = unstable_cache(
  async (): Promise<string[]> => {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true },
    })
    return products.map((p) => p.slug)
  },
  ["product-slugs"],
  { revalidate: 86400, tags: [CACHE_TAGS.products, CACHE_TAGS.sitemap] }
)

async function getFilterOptionsUncached(productType?: ProductType) {
  const baseWhere: Prisma.ProductWhereInput = {
    isActive: true,
    ...(productType ? { productType } : {}),
  }

  if (productType === "tea") {
    const [origins, teaCategories] = await Promise.all([
      prisma.product.findMany({
        where: { ...baseWhere, origin: { not: null } },
        select: { origin: true },
        distinct: ["origin"],
      }),
      prisma.category.findMany({
        where: { parent: { slug: "chay" }, isActive: true },
        select: { name: true, slug: true },
        orderBy: { sortOrder: "asc" },
      }),
    ])
    return {
      origins: origins.map((o) => o.origin!).filter(Boolean),
      roastLevels: [],
      brewingMethods: [],
      teaTypes: teaCategories,
      productForms: ["листовой", "пакетики"],
    }
  }

  if (productType === "instant") {
    const productForms = await prisma.product.findMany({
      where: { ...baseWhere, productForm: { not: null } },
      select: { productForm: true },
      distinct: ["productForm"],
    })
    return {
      origins: [],
      roastLevels: [],
      brewingMethods: [],
      teaTypes: [],
      productForms: productForms.map((p) => p.productForm!).filter(Boolean),
    }
  }

  // Default: coffee
  const [origins, roastLevels] = await Promise.all([
    prisma.product.findMany({
      where: { ...baseWhere, origin: { not: null } },
      select: { origin: true },
      distinct: ["origin"],
    }),
    prisma.product.findMany({
      where: { ...baseWhere, roastLevel: { not: null } },
      select: { roastLevel: true },
      distinct: ["roastLevel"],
    }),
  ])

  return {
    origins: origins.map((o) => o.origin!).filter(Boolean),
    roastLevels: roastLevels.map((r) => r.roastLevel!).filter(Boolean),
    brewingMethods: ["espresso", "filter", "french-press", "turka"],
    teaTypes: [],
    productForms: [],
  }
}

export async function getFilterOptions(productType?: ProductType) {
  return unstable_cache(
    () => getFilterOptionsUncached(productType),
    ["filter-options", productType ?? "all"],
    { revalidate: 3600, tags: [CACHE_TAGS.filters, CACHE_TAGS.products] }
  )()
}
