import Link from "next/link"
import { ArticleCard } from "./ArticleCard"
import type { ArticleCard as ArticleCardType } from "@/lib/types"

interface ArticleGridProps {
  articles: ArticleCardType[]
  currentPage: number
  totalPages: number
  baseSearchParams?: Record<string, string>
}

export function ArticleGrid({ articles, currentPage, totalPages, baseSearchParams = {} }: ArticleGridProps) {
  function buildHref(page: number) {
    const params = new URLSearchParams(baseSearchParams)
    if (page > 1) params.set("page", String(page))
    const qs = params.toString()
    return `/blog${qs ? `?${qs}` : ""}`
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-16">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              href={buildHref(page)}
              className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                page === currentPage
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {page}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
