import Link from "next/link"
import { ArticleCard } from "./ArticleCard"
import { paginateRange } from "@/lib/utils"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap justify-center gap-2 mt-10 sm:mt-16">
          {paginateRange(currentPage, totalPages).map((page, i) =>
            page === "..." ? (
              <span
                key={`ellipsis-${i}`}
                aria-hidden="true"
                className="w-10 h-10 flex items-center justify-center text-sm text-muted-foreground"
              >
                …
              </span>
            ) : (
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
            )
          )}
        </div>
      )}
    </div>
  )
}
