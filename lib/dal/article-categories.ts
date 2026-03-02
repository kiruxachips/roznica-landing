import { prisma } from "@/lib/prisma"
import type { ArticleCategoryInfo } from "@/lib/types"

export async function getArticleCategories(): Promise<ArticleCategoryInfo[]> {
  const categories = await prisma.articleCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          articles: { where: { isPublished: true } },
        },
      },
    },
  })

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    articleCount: c._count.articles,
  }))
}

export async function getArticleCategoryBySlug(slug: string) {
  return prisma.articleCategory.findUnique({
    where: { slug },
  })
}
