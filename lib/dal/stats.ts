import { prisma } from "@/lib/prisma"
import { unstable_cache } from "next/cache"
import { CACHE_TAGS } from "@/lib/cache-tags"

export interface ShopStats {
  reviewsCount: number
  averageRating: number | null
  ordersCount: number
  activeProductsCount: number
}

/**
 * Real-world shop stats used on the home page social proof strip.
 * Returns conservative values (nulls / 0) if DB is unreachable.
 */
async function getShopStatsUncached(): Promise<ShopStats> {
  try {
    const [reviewsAgg, orders, productsCount] = await Promise.all([
      prisma.review.aggregate({
        where: { isVisible: true },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.order.count({
        where: {
          status: { in: ["delivered", "shipped", "paid", "confirmed"] },
        },
      }),
      prisma.product.count({ where: { isActive: true } }),
    ])

    const reviewsCount = reviewsAgg._count._all
    const avg = reviewsAgg._avg.rating
    const averageRating = avg !== null && avg !== undefined ? Math.round(avg * 10) / 10 : null

    return {
      reviewsCount,
      averageRating,
      ordersCount: orders,
      activeProductsCount: productsCount,
    }
  } catch {
    return { reviewsCount: 0, averageRating: null, ordersCount: 0, activeProductsCount: 0 }
  }
}

export const getShopStats = unstable_cache(
  getShopStatsUncached,
  ["shop-stats"],
  { revalidate: 600, tags: [CACHE_TAGS.stats, CACHE_TAGS.products] }
)
