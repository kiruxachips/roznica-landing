import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ArticleForm } from "@/components/admin/ArticleForm"
import { requireAdmin } from "@/lib/admin-guard"

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("blog.edit")
  const { id } = await params

  const [article, categories] = await Promise.all([
    prisma.article.findUnique({ where: { id } }),
    prisma.articleCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ])

  if (!article) notFound()

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Редактирование: {article.title}</h1>
      <ArticleForm article={article} categories={categories} />
    </div>
  )
}
