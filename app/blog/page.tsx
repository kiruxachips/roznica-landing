export const dynamic = "force-dynamic"

import { Metadata } from "next"
import { getArticles } from "@/lib/dal/articles"
import { getArticleCategories } from "@/lib/dal/article-categories"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { BlogHero } from "@/components/blog/BlogHero"
import { BrewingGuides } from "@/components/blog/BrewingGuides"
import { CategoryTabs } from "@/components/blog/CategoryTabs"
import { ArticleGrid } from "@/components/blog/ArticleGrid"

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}): Promise<Metadata> {
  const params = await searchParams
  const page = Number(params.page) || 1
  const canonical = page > 1 ? `/blog?page=${page}` : "/blog"

  return {
    title: "Журнал о кофе | Millor Coffee",
    description: "Статьи о кофе, обжарке, способах приготовления и кофейной культуре от Millor Coffee.",
    alternates: { canonical },
  }
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; tag?: string; search?: string; page?: string }>
}) {
  const params = await searchParams
  const filters = {
    categorySlug: params.category,
    tag: params.tag,
    search: params.search,
    page: Number(params.page) || 1,
    limit: 9,
  }

  const [{ articles, total }, categories] = await Promise.all([
    getArticles(filters),
    getArticleCategories(),
  ])

  const totalPages = Math.ceil(total / 9)

  const baseSearchParams: Record<string, string> = {}
  if (params.category) baseSearchParams.category = params.category
  if (params.tag) baseSearchParams.tag = params.tag
  if (params.search) baseSearchParams.search = params.search

  return (
    <>
      <Header />
      <main className="pt-16">
        <BlogHero />
        <BrewingGuides />

        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <CategoryTabs categories={categories} activeCategory={params.category} />

            {articles.length > 0 ? (
              <ArticleGrid
                articles={articles}
                currentPage={filters.page}
                totalPages={totalPages}
                baseSearchParams={baseSearchParams}
              />
            ) : (
              <div className="text-center py-16">
                <p className="text-lg text-muted-foreground">Статей пока нет</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
