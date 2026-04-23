import { prisma } from "@/lib/prisma"
import { unstable_cache } from "next/cache"
import { CACHE_TAGS } from "@/lib/cache-tags"
import { getDeliverySettings } from "@/lib/dal/delivery-settings"

/**
 * Глобальный kill-switch программы подарков. По умолчанию включена
 * (migration seed'ит "true"). Админ отключает через /admin/delivery —
 * мгновенно скрывает всю gift-UI и отклоняет selectedGiftId в createOrder.
 * Ключ gifts_enabled в той же таблице DeliverySetting, что cdek_enabled/
 * pochta_enabled, чтобы не плодить новые config-таблицы.
 */
export async function areGiftsEnabled(): Promise<boolean> {
  const settings = await getDeliverySettings()
  // Дефолт "true" на случай если миграция не применилась (legacy env)
  return settings.gifts_enabled !== "false"
}

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
  /** Для клиента unified: null = unlimited / 0 = закончился / N = осталось.
   *  Для linked-gift = ProductVariant.stock, для custom = Gift.stock. */
  stockRemaining: number | null
}

/**
 * Подарки, доступные клиенту с данным cartTotal. Возвращаются только активные,
 * отсортированные по sortOrder → minCartTotal desc (сначала дороже). Stock=0
 * отфильтровывается, stock=null (unlimited) остаётся.
 */
export async function getAvailableGifts(cartTotal: number): Promise<GiftCard[]> {
  // Kill-switch: при выключенной программе возвращаем пусто — UI и backend
  // сами обрабатывают это как "подарков нет".
  if (!(await areGiftsEnabled())) return []

  const gifts = await prisma.gift.findMany({
    where: {
      isActive: true,
      minCartTotal: { lte: cartTotal },
    },
    orderBy: [{ sortOrder: "asc" }, { minCartTotal: "desc" }],
    include: {
      productVariant: {
        select: { stock: true, isActive: true, weight: true, product: { select: { name: true, isActive: true } } },
      },
    },
  })

  return gifts
    .map<GiftCard | null>((g) => {
      // Stock источник зависит от типа подарка
      const effectiveStock = g.productVariantId
        ? g.productVariant?.stock ?? 0
        : g.stock
      // Linked-gift исключаем если товар/вариант деактивирован
      if (g.productVariantId) {
        if (!g.productVariant) return null
        if (!g.productVariant.isActive || !g.productVariant.product.isActive) return null
      }
      // 0 = закончился; null = unlimited (только для custom)
      if (effectiveStock !== null && effectiveStock <= 0) return null

      return {
        id: g.id,
        name: g.name,
        description: g.description,
        imageUrl: g.imageUrl,
        imageAlt: g.imageAlt,
        minCartTotal: g.minCartTotal,
        stockRemaining: effectiveStock,
      }
    })
    .filter((g): g is GiftCard => g !== null)
}

/**
 * Минимальный порог среди активных gift'ов — используется UI-прогрессом
 * "До подарка — X₽". Если ни одного active gift нет → 0 (UI прячет прогресс).
 * Кэшируется по тегу: при изменении пула gifts в админке сбрасывается.
 */
// Внутренняя cached-функция — чтение Gift-таблицы. Kill-switch НЕ кэшируем
// вместе с ней, иначе toggle в админке будет ждать revalidateTag.
const getRawMinGiftThreshold = unstable_cache(
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

export async function getMinGiftThreshold(): Promise<number> {
  if (!(await areGiftsEnabled())) return 0
  return getRawMinGiftThreshold()
}

/** Админский листинг с полной информацией */
export async function listGiftsForAdmin() {
  return prisma.gift.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      productVariant: {
        select: {
          id: true,
          weight: true,
          sku: true,
          stock: true,
          product: { select: { id: true, name: true, isActive: true } },
        },
      },
    },
  })
}

export interface VariantForGift {
  variantId: string
  productId: string
  productName: string
  productSlug: string
  weight: string
  sku: string | null
  price: number
  stock: number
  /** Дни с последнего списания (order_placed/gifted). Null — ни разу
   *  не списывался. Чем выше — тем более «неликвид», хорошо подарить. */
  daysSinceLastSale: number | null
  /** Уже привязан к активному Gift? Чтобы не предложить повторно. */
  linkedToActiveGift: boolean
  isActive: boolean
}

/**
 * Варианты товаров для product-picker в админке подарков.
 * Помимо базовых полей, считает daysSinceLastSale — сколько дней с
 * последнего списания (order_placed или gifted). Большое значение +
 * большой остаток = хороший кандидат на подарок, чтобы раздать неликвид.
 *
 * Сортировка по умолчанию: stock desc → подсветка того что больше всего лежит.
 * UI может пересортировать по daysSinceLastSale.
 */
export async function listVariantsForGift(options: {
  /** Поиск по названию товара / SKU */
  search?: string
  /** Ограничить первые N — дефолт 100 */
  limit?: number
}): Promise<VariantForGift[]> {
  const search = options.search?.trim()
  const limit = options.limit ?? 100

  const variants = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      product: {
        isActive: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { variants: { some: { sku: { contains: search, mode: "insensitive" as const } } } },
              ],
            }
          : {}),
      },
    },
    orderBy: [{ stock: "desc" }, { product: { sortOrder: "asc" } }],
    take: limit,
    select: {
      id: true,
      weight: true,
      sku: true,
      price: true,
      stock: true,
      isActive: true,
      productId: true,
      product: { select: { name: true, slug: true } },
      stockHistory: {
        where: { reason: { in: ["order_placed", "gifted"] }, delta: { lt: 0 } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      linkedGifts: {
        where: { isActive: true },
        select: { id: true },
      },
    },
  })

  const now = Date.now()
  return variants.map((v) => {
    const lastSale = v.stockHistory[0]?.createdAt
    const daysSinceLastSale = lastSale
      ? Math.floor((now - lastSale.getTime()) / (1000 * 60 * 60 * 24))
      : null
    return {
      variantId: v.id,
      productId: v.productId,
      productName: v.product.name,
      productSlug: v.product.slug,
      weight: v.weight,
      sku: v.sku,
      price: v.price,
      stock: v.stock,
      daysSinceLastSale,
      linkedToActiveGift: v.linkedGifts.length > 0,
      isActive: v.isActive,
    }
  })
}

export async function getGiftById(id: string) {
  return prisma.gift.findUnique({ where: { id } })
}

/**
 * Возвращает единицу подарка обратно на склад при отмене заказа.
 *
 * Три сценария:
 *   1) linked-gift (productVariantId задан) → инкремент ProductVariant.stock
 *      через adjustStock(reason="gift_returned"), чтобы появилось в stockHistory.
 *   2) custom-gift с числовым stock → UPDATE Gift SET stock = stock + 1.
 *   3) unlimited custom-gift (stock=NULL) → no-op.
 *
 * Атомарно; caller обязан гарантировать одиночный вызов (т.е. обнулять
 * selectedGiftId в той же транзакции), иначе будет double-refund.
 */
export async function refundGift(
  giftId: string,
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<void> {
  const client = tx ?? prisma
  const gift = await client.gift.findUnique({
    where: { id: giftId },
    select: { productVariantId: true, stock: true },
  })
  if (!gift) return

  if (gift.productVariantId) {
    // Динамический import чтобы не крутить circular dep (stock → gifts?)
    const { adjustStock } = await import("@/lib/dal/stock")
    await adjustStock(
      {
        variantId: gift.productVariantId,
        delta: +1,
        reason: "gift_returned",
        changedBy: "system",
      },
      tx
    )
    return
  }

  if (gift.stock !== null) {
    await client.$executeRaw`
      UPDATE "Gift" SET stock = stock + 1 WHERE id = ${giftId} AND stock IS NOT NULL
    `
  }
}

// Backwards-compat alias: старые callsites импортируют refundGiftStock.
export const refundGiftStock = refundGift
