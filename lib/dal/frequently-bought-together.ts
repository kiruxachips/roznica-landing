import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { mapToProductCard, productCardSelect } from "@/lib/dal/products"
import type { ProductCard } from "@/lib/types"
import { CACHE_TAGS } from "@/lib/cache-tags"

/**
 * «Часто покупают вместе» — top-N товаров, которые чаще всего оказывались
 * в одной корзине с данным productId.
 *
 * Алгоритм: из OrderItem берём все orderId где встречается productId,
 * потом ищем OrderItem.productId != productId для тех же orderId,
 * GROUP BY productId с COUNT, сортируем по count desc.
 *
 * Кэш 1 час — относительно статичные данные, пересчитываются когда
 * добавляются новые заказы (тег products).
 */
async function computeFBT(productId: string, limit = 4): Promise<ProductCard[]> {
  // 1. Находим все orderId с этим товаром (не cancelled)
  const orderIds = await prisma.orderItem.findMany({
    where: {
      productId,
      order: {
        status: { in: ["paid", "confirmed", "shipped", "delivered"] },
      },
    },
    select: { orderId: true },
    take: 500, // ограничиваем выборку — на очень популярных товарах full-scan дорогой
  })

  if (orderIds.length === 0) return []

  const uniqueOrderIds = Array.from(new Set(orderIds.map((o) => o.orderId)))

  // 2. Для тех же orderId — считаем сопутствующие товары.
  const cooccur = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      orderId: { in: uniqueOrderIds },
      productId: { not: productId },
    },
    _count: { _all: true },
    orderBy: { _count: { productId: "desc" } },
    take: limit * 3, // с запасом — отсечём удалённые/inactive на следующем шаге
  })

  if (cooccur.length === 0) return []

  // 3. Подгружаем сами продукты. Фильтруем inactive.
  // groupBy productId может быть null (у OrderItem FK SetNull) — фильтруем.
  const cooccurIds = cooccur
    .map((c) => c.productId)
    .filter((id): id is string => id !== null)
  if (cooccurIds.length === 0) return []

  const products = await prisma.product.findMany({
    where: {
      id: { in: cooccurIds },
      isActive: true,
    },
    select: productCardSelect,
  })

  // Сохраняем порядок по cooccur-ranking.
  const rankMap = new Map(cooccurIds.map((id, i) => [id, i]))
  products.sort((a, b) => (rankMap.get(a.id) ?? 999) - (rankMap.get(b.id) ?? 999))

  return products.slice(0, limit).map(mapToProductCard)
}

export function getFrequentlyBoughtTogether(
  productId: string,
  limit = 4
): Promise<ProductCard[]> {
  return unstable_cache(
    () => computeFBT(productId, limit),
    ["fbt", productId, String(limit)],
    { revalidate: 3600, tags: [CACHE_TAGS.products] }
  )()
}
