import { prisma } from "@/lib/prisma"

export async function listPriceLists() {
  return prisma.priceList.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      kind: true,
      discountPct: true,
      minOrderSum: true,
      createdAt: true,
      _count: { select: { items: true, companies: true } },
    },
  })
}

export async function getPriceListById(id: string) {
  return prisma.priceList.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { createdAt: "desc" },
        include: {
          variant: {
            select: {
              id: true,
              weight: true,
              price: true,
              sku: true,
              isActive: true,
              product: { select: { id: true, name: true, slug: true, isActive: true } },
            },
          },
        },
      },
      companies: {
        select: { id: true, legalName: true, status: true },
      },
    },
  })
}

/**
 * Для редактора: всех активных вариантов каталога с розничной ценой —
 * чтобы админ мог выбрать какому варианту задать оптовую цену.
 */
export async function getAllActiveVariantsForPricing() {
  return prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true } },
    orderBy: [{ product: { name: "asc" } }, { sortOrder: "asc" }],
    select: {
      id: true,
      weight: true,
      price: true,
      sku: true,
      wholesaleMinQuantity: true,
      product: {
        select: { id: true, name: true, slug: true },
      },
    },
  })
}
