import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import type { CategoryInfo } from "@/lib/types"
import { CACHE_TAGS } from "@/lib/cache-tags"

// F4-1: кеш 5 минут + revalidate по тегу "products" (когда товары в
// категории меняются) и "catalog" (когда сама категория обновлена).
// Без кеша getCategories бил БД на каждом рендере header/меню.
export const getCategories = unstable_cache(
  async (): Promise<CategoryInfo[]> => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { products: { where: { isActive: true } } } },
      },
    })

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      image: c.image,
      productCount: c._count.products,
    }))
  },
  ["getCategories"],
  { revalidate: 300, tags: [CACHE_TAGS.catalog, CACHE_TAGS.products] }
)

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug, isActive: true },
  })
}
