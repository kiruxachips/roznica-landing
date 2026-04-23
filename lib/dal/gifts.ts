import { prisma } from "@/lib/prisma"
import { unstable_cache } from "next/cache"
import { CACHE_TAGS } from "@/lib/cache-tags"

/**
 * Публичный DAL для подарков на checkout.
 */

export interface GiftCard {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  imageAlt: string | null
  minCartTotal: number
  /** undefined = unlimited; 0 = закончился */
  stockRemaining: number | null
}

/**
 * Подарки, доступные клиенту с данным cartTotal. Возвращаются только активные,
 * отсортированные по sortOrder → minCartTotal desc (сначала дороже). Stock=0
 * отфильтровывается, stock=null (unlimited) остаётся.
 */
export async function getAvailableGifts(cartTotal: number): Promise<GiftCard[]> {
  const gifts = await prisma.gift.findMany({
    where: {
      isActive: true,
      minCartTotal: { lte: cartTotal },
    },
    orderBy: [{ sortOrder: "asc" }, { minCartTotal: "desc" }],
  })
  return gifts
    .filter((g) => g.stock === null || g.stock > 0)
    .map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      imageUrl: g.imageUrl,
      imageAlt: g.imageAlt,
      minCartTotal: g.minCartTotal,
      stockRemaining: g.stock,
    }))
}

/**
 * Минимальный порог среди активных gift'ов — используется UI-прогрессом
 * "До подарка — X₽". Если ни одного active gift нет → 0 (UI прячет прогресс).
 * Кэшируется по тегу: при изменении пула gifts в админке сбрасывается.
 */
export const getMinGiftThreshold = unstable_cache(
  async (): Promise<number> => {
    const g = await prisma.gift.findFirst({
      where: { isActive: true },
      orderBy: { minCartTotal: "asc" },
      select: { minCartTotal: true },
    })
    return g?.minCartTotal ?? 0
  },
  ["min-gift-threshold"],
  { revalidate: 300, tags: [CACHE_TAGS.gifts] }
)

/** Админский листинг с полной информацией */
export async function listGiftsForAdmin() {
  return prisma.gift.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  })
}

export async function getGiftById(id: string) {
  return prisma.gift.findUnique({ where: { id } })
}

/**
 * Возвращает единицу подарка на склад при отмене заказа. Идемпотентно в том
 * смысле, что stock=NULL (unlimited) не трогается; повторный вызов с тем же
 * giftId будет добавлять ещё +1 — поэтому caller обязан гарантировать
 * одиночный вызов (обычно это происходит ровно один раз при cancellation).
 *
 * Атомарный $executeRaw вместо read-modify-write чтобы избежать race при
 * параллельных отменах разных заказов с одним подарком.
 */
export async function refundGiftStock(
  giftId: string,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<void> {
  const client = tx ?? prisma
  await client.$executeRaw`
    UPDATE "Gift" SET stock = stock + 1 WHERE id = ${giftId} AND stock IS NOT NULL
  `
}
