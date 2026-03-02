import { prisma } from "@/lib/prisma"
import { ArticleForm } from "@/components/admin/ArticleForm"

export default async function NewArticlePage() {
  const categories = await prisma.articleCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Новая статья</h1>
      <ArticleForm categories={categories} />
    </div>
  )
}
