import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getArticles } from "@/lib/dal/articles"
import { ArticleCard } from "@/components/blog/ArticleCard"

export async function FeaturedBlog() {
  let articles: Awaited<ReturnType<typeof getArticles>>["articles"] = []
  try {
    const result = await getArticles({ page: 1, limit: 3 })
    articles = result.articles
  } catch {
    return null
  }

  if (articles.length === 0) return null

  return (
    <section aria-label="Блог" className="py-12 sm:py-16 lg:py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-10">
          <div className="max-w-2xl">
            <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2 sm:mb-3">
              Читайте о кофе
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Гайды, истории происхождения и всё что нужно знать о хорошем кофе.
            </p>
          </div>
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors shrink-0 self-start sm:self-end"
          >
            Все статьи
            <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </div>
    </section>
  )
}
