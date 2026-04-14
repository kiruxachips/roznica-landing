import { prisma } from "@/lib/prisma"

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
export async function getShopStats(): Promise<ShopStats> {
  try {
    const [reviews, orders, productsCount] = await Promise.all([
      prisma.review.findMany({
        where: { isVisible: true },
        select: { rating: true },
      }),
      prisma.order.count({
        where: {
          status: { in: ["delivered", "shipped", "paid", "confirmed"] },
        },
      }),
      prisma.product.count({ where: { isActive: true } }),
    ])

    const reviewsCount = reviews.length
    const averageRating =
      reviewsCount > 0
        ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviewsCount) * 10) / 10
        : null

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
