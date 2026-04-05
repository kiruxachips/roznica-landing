import { prisma } from "@/lib/prisma"
import type { ProductCard } from "@/lib/types"

export async function getAllCollections() {
  return prisma.productCollection.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  })
}

export async function getCollectionById(id: string) {
  return prisma.productCollection.findUnique({
    where: { id },
    include: {
      products: {
        orderBy: { sortOrder: "asc" },
        include: {
          product: {
            select: { id: true, name: true, slug: true },
          },
        },
      },
    },
  })
}

// For admin product form — include inactive
export async function getCollectionIdsForProduct(productId: string) {
  const items = await prisma.productCollectionItem.findMany({
    where: { productId },
    select: { collectionId: true },
  })
  return items.map((i) => i.collectionId)
}

// For catalog page — active collections with products mapped to ProductCard
export async function getCollectionsWithProducts(): Promise<
  { id: string; name: string; slug: string; emoji: string | null; products: ProductCard[] }[]
> {
  const collections = await prisma.productCollection.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      products: {
        orderBy: { sortOrder: "asc" },
        take: 10,
        include: {
          product: {
            include: {
              images: { where: { isPrimary: true }, take: 1 },
              variants: { where: { isActive: true }, orderBy: { price: "asc" } },
              reviews: { where: { isVisible: true }, select: { rating: true } },
            },
          },
        },
      },
    },
  })

  return collections
    .filter((c) => c.products.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      emoji: c.emoji,
      products: c.products
        .filter((ci) => ci.product.isActive)
        .map((ci) => {
          const p = ci.product
          const reviewCount = p.reviews.length
          const averageRating = reviewCount > 0
            ? Math.round((p.reviews.reduce((s, r) => s + r.rating, 0) / reviewCount) * 10) / 10
            : null
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
            minPrice: p.variants[0]?.price ?? null,
            minOldPrice: p.variants[0]?.oldPrice ?? null,
            firstVariant: p.variants[0]
              ? { id: p.variants[0].id, weight: p.variants[0].weight, price: p.variants[0].price, oldPrice: p.variants[0].oldPrice, stock: p.variants[0].stock }
              : null,
            variants: p.variants.map((v) => ({ id: v.id, weight: v.weight, price: v.price, oldPrice: v.oldPrice, stock: v.stock })),
            reviewCount,
            averageRating,
          }
        }),
    }))
}
