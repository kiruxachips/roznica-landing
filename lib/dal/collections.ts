import { prisma } from "@/lib/prisma"
import type { ProductCard } from "@/lib/types"
import { unstable_cache } from "next/cache"
import { CACHE_TAGS } from "@/lib/cache-tags"

export const getAllCollections = unstable_cache(
  () =>
    prisma.productCollection.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } } },
    }),
  ["all-collections"],
  { revalidate: 60, tags: [CACHE_TAGS.collections] }
)

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
    select: {
      id: true,
      name: true,
      slug: true,
      emoji: true,
      products: {
        orderBy: { sortOrder: "asc" },
        take: 20,
        select: {
          product: {
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
              isActive: true,
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
            },
          },
        },
      },
    },
  })

  // Собираем все productId, участвующие в коллекциях, одним запросом считаем
  // средний рейтинг + количество видимых отзывов. Это убирает N+1 и исключает
  // загрузку всех rating'ов в память Node (может быть тысячи записей).
  const productIds = collections.flatMap((c) =>
    c.products.filter((ci) => ci.product.isActive).map((ci) => ci.product.id)
  )
  const uniqueProductIds = Array.from(new Set(productIds))

  const ratingStats =
    uniqueProductIds.length > 0
      ? await prisma.review.groupBy({
          by: ["productId"],
          where: { isVisible: true, productId: { in: uniqueProductIds } },
          _avg: { rating: true },
          _count: { _all: true },
        })
      : []
  const ratingByProduct = new Map(
    ratingStats.map((r) => [
      r.productId,
      {
        average: r._avg.rating !== null && r._avg.rating !== undefined ? Math.round(r._avg.rating * 10) / 10 : null,
        count: r._count._all,
      },
    ])
  )

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
          const stats = ratingByProduct.get(p.id)
          return {
            id: p.id,
            name: p.name,
            slug: p.slug,
            description: p.description,
            productType: p.productType as import("@/lib/types").ProductType,
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
              ? { id: p.variants[0].id, weight: p.variants[0].weight, price: p.variants[0].price, oldPrice: p.variants[0].oldPrice, stock: p.variants[0].stock }
              : null,
            variants: p.variants.map((v) => ({ id: v.id, weight: v.weight, price: v.price, oldPrice: v.oldPrice, stock: v.stock })),
            reviewCount: stats?.count ?? 0,
            averageRating: stats?.average ?? null,
          }
        }),
    }))
}
