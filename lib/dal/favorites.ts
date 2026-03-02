import { prisma } from "@/lib/prisma"

export async function getFavoritesByUserId(
  userId: string,
  { page = 1, limit = 12 } = {}
) {
  const [favorites, total] = await Promise.all([
    prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        product: {
          include: {
            images: { where: { isPrimary: true }, take: 1 },
            variants: { where: { isActive: true }, orderBy: { price: "asc" } },
            reviews: { where: { isVisible: true }, select: { rating: true } },
          },
        },
      },
    }),
    prisma.favorite.count({ where: { userId } }),
  ])

  return { favorites, total }
}

export async function isProductFavorited(userId: string, productId: string) {
  const fav = await prisma.favorite.findUnique({
    where: { userId_productId: { userId, productId } },
  })
  return !!fav
}

export async function getFavoritesCount(userId: string) {
  return prisma.favorite.count({ where: { userId } })
}

export async function getFavoriteProductIds(userId: string) {
  const favs = await prisma.favorite.findMany({
    where: { userId },
    select: { productId: true },
  })
  return favs.map((f) => f.productId)
}

export async function checkFavoritesByProductIds(
  userId: string,
  productIds: string[]
) {
  const favs = await prisma.favorite.findMany({
    where: { userId, productId: { in: productIds } },
    select: { productId: true },
  })
  return new Set(favs.map((f) => f.productId))
}
