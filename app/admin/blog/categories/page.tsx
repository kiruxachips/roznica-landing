export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { ArticleCategoryManager } from "@/components/admin/ArticleCategoryManager"
import { requireAdmin } from "@/lib/admin-guard"

export default async function AdminBlogCategoriesPage() {
  await requireAdmin("blog.edit")
  const categories = await prisma.articleCategory.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { articles: true } },
    },
  })

  const formatted = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    articleCount: c._count.articles,
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Рубрики блога</h1>
      <ArticleCategoryManager categories={formatted} />
    </div>
  )
}
