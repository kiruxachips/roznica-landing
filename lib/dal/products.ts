import { prisma } from "@/lib/prisma"
import type { ProductCard, ProductDetail, ProductFilters } from "@/lib/types"
import { Prisma } from "@prisma/client"

export async function getProducts(filters: ProductFilters = {}): Promise<{
  products: ProductCard[]
  total: number
}> {
  const { categorySlug, roastLevel, origin, brewingMethod, search, sort, page = 1, limit = 12 } = filters

  const where: Prisma.ProductWhereInput = {
    isActive: true,
  }

  if (categorySlug) {
    where.category = { slug: categorySlug }
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

  let orderBy: Prisma.ProductOrderByWithRelationInput = { sortOrder: "asc" }
  if (sort === "newest") orderBy = { createdAt: "desc" }
  if (sort === "popular") orderBy = { sortOrder: "asc" }

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        variants: { where: { isActive: true }, orderBy: { price: "asc" }, take: 1 },
        reviews: { where: { isVisible: true }, select: { rating: true } },
      },
    }),
    prisma.product.count({ where }),
  ])

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
    reviewCount: p.reviews.length,
    averageRating:
      p.reviews.length > 0
        ? Math.round((p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length) * 10) / 10
        : null,
  }))

  // Sort by price after fetching (since price is on variant)
  if (sort === "price-asc") {
    products = products.sort((a, b) => (a.minPrice ?? 0) - (b.minPrice ?? 0))
  } else if (sort === "price-desc") {
    products = products.sort((a, b) => (b.minPrice ?? 0) - (a.minPrice ?? 0))
  }

  return { products, total }
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const product = await prisma.product.findUnique({
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
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      reviews: { where: { isVisible: true }, select: { rating: true } },
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
