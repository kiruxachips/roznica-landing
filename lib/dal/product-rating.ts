import { prisma } from "@/lib/prisma"

/**
 * Пересчитывает денормализованные Product.avgRating и Product.reviewCount
 * для одного продукта. Вызывается при мутациях Review (toggle visibility,
 * delete, future create).
 *
 * Альтернативный путь — Prisma middleware/extension с авто-hook'ами, но это
 * делает логику менее явной и усложняет отладку. Явный вызов лучше.
 *
 * Если Product не существует (race со delete Product) — тихо игнорируем.
 */
export async function recomputeProductRating(productId: string): Promise<void> {
  const agg = await prisma.review.aggregate({
    where: { productId, isVisible: true },
    _count: { _all: true },
    _avg: { rating: true },
  })

  try {
    await prisma.product.update({
      where: { id: productId },
      data: {
        reviewCount: agg._count._all,
        avgRating: agg._avg.rating,
      },
    })
  } catch (e) {
    // P2025 = record not found (product deleted), игнорим.
    if (typeof e === "object" && e && (e as { code?: string }).code === "P2025") {
      return
    }
    throw e
  }
}
