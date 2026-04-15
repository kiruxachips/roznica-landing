import { prisma } from "@/lib/prisma"
import type { ProductCard, ProductDetail, ProductFilters } from "@/lib/types"
import { Prisma } from "@prisma/client"

// Shared select shape for ProductCard listings — keeps payload minimal
const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  origin: true,
  roastLevel: true,
  badge: true,
  flavorNotes: true,
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

export async function getProducts(filters: ProductFilters = {}): Promise<{
  products: ProductCard[]
  total: number
}> {
  const { categorySlug, collectionSlug, roastLevel, origin, brewingMethod, search, sort, page = 1, limit = 12 } = filters

  const where: Prisma.ProductWhereInput = {
    isActive: true,
  }

  if (categorySlug) {
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
  if (sort === "popular") orderBy = { sortOrder: "asc" }

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

  let products: ProductCard[] = items.map((p) => ({
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
    firstVariant: p.variants[0] ? { id: p.variants[0].id, weight: p.variants[0].weight, price: p.variants[0].price, oldPrice: p.variants[0].oldPrice, stock: p.variants[0].stock } : null,
    variants: p.variants.map((v) => ({ id: v.id, weight: v.weight, price: v.price, oldPrice: v.oldPrice, stock: v.stock })),
    reviewCount: p.reviews.length,
    averageRating:
      p.reviews.length > 0
        ? Math.round((p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length) * 10) / 10
        : null,
  }))

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

export async function getFeaturedProducts(limit = 3): Promise<ProductCard[]> {
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

  return items.map((p) => {
    // Get the 1kg variant price for featured display, or first variant
    const displayVariant = p.variants.find((v) => v.weight === "1кг") ?? p.variants[0]
    return {
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
      minPrice: displayVariant?.price ?? null,
      minOldPrice: displayVariant?.oldPrice ?? null,
      firstVariant: displayVariant ? { id: displayVariant.id, weight: displayVariant.weight, price: displayVariant.price, oldPrice: displayVariant.oldPrice, stock: displayVariant.stock } : null,
      reviewCount: p.reviews.length,
      averageRating:
        p.reviews.length > 0
          ? Math.round((p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length) * 10) / 10
          : null,
    }
  })
}

export async function getProductSlugs(): Promise<string[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { slug: true },
  })
  return products.map((p) => p.slug)
}

export async function getFilterOptions() {
  const [origins, roastLevels] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true, origin: { not: null } },
      select: { origin: true },
      distinct: ["origin"],
    }),
    prisma.product.findMany({
      where: { isActive: true, roastLevel: { not: null } },
      select: { roastLevel: true },
      distinct: ["roastLevel"],
    }),
  ])

  return {
    origins: origins.map((o) => o.origin!).filter(Boolean),
    roastLevels: roastLevels.map((r) => r.roastLevel!).filter(Boolean),
    brewingMethods: ["espresso", "filter", "french-press", "turka"],
  }
}
