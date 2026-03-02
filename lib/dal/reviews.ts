import { prisma } from "@/lib/prisma"

export async function getReviewsByProduct(productId: string) {
  return prisma.review.findMany({
    where: { productId, isVisible: true },
    orderBy: { createdAt: "desc" },
  })
}

export async function getAllReviews(filters: { isVisible?: boolean } = {}) {
  const where: { isVisible?: boolean } = {}
  if (filters.isVisible !== undefined) {
    where.isVisible = filters.isVisible
  }

  return prisma.review.findMany({
    where,
    include: {
      product: { select: { name: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}
