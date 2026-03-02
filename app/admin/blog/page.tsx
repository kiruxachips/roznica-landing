export const dynamic = "force-dynamic"

import Link from "next/link"
import Image from "next/image"
import { prisma } from "@/lib/prisma"
import { Plus } from "lucide-react"
import { ArticleActions } from "./ArticleActions"

export default async function AdminBlogPage() {
  const articles = await prisma.article.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true } },
    },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Статьи</h1>
        <Link
          href="/admin/blog/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Новая статья
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Статья</th>
              <th className="text-left px-4 py-3 font-medium">Рубрика</th>
              <th className="text-left px-4 py-3 font-medium">Статус</th>
              <th className="text-left px-4 py-3 font-medium">Дата</th>
              <th className="text-left px-4 py-3 font-medium">Просмотры</th>
              <th className="w-28 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {article.coverImage ? (
                      <Image
                        src={article.coverImage}
                        alt={article.title}
                        width={48}
                        height={32}
                        className="w-12 h-8 rounded object-cover"
                      />
                    ) : (
                      <div className="w-12 h-8 rounded bg-muted" />
                    )}
                    <div>
                      <p className="font-medium line-clamp-1">{article.title}</p>
                      <p className="text-xs text-muted-foreground">{article.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {article.category?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${article.isPublished ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {article.isPublished ? "Опубликована" : "Черновик"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {article.publishedAt
                    ? new Date(article.publishedAt).toLocaleDateString("ru-RU")
                    : new Date(article.createdAt).toLocaleDateString("ru-RU")}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{article.viewCount}</td>
                <td className="px-4 py-3">
                  <ArticleActions articleId={article.id} articleTitle={article.title} isPublished={article.isPublished} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {articles.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">Нет статей</div>
        )}
      </div>
    </div>
  )
}
