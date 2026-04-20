import { prisma } from "@/lib/prisma"

export async function getReviewsByProduct(productId: string) {
  return prisma.review.findMany({
    where: { productId, isVisible: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function getAllReviews(filters: { isVisible?: boolean; page?: number; limit?: number } = {}) {
  const where: { isVisible?: boolean } = {}
  if (filters.isVisible !== undefined) {
    where.isVisible = filters.isVisible
  }

  const page = Math.max(1, filters.page ?? 1)
  const limit = Math.max(1, Math.min(200, filters.limit ?? 50))

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        product: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.review.count({ where }),
  ])

  return { reviews, total, page, limit }
}
