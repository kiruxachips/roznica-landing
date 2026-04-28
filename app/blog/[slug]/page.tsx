export const dynamic = "force-dynamic"

import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ChevronRight, Calendar, Clock, Eye } from "lucide-react"
import { getArticleBySlug, getArticleSlugs, getRelatedArticles, incrementArticleViewCount } from "@/lib/dal/articles"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { ArticleCard } from "@/components/blog/ArticleCard"
import { sanitizeArticleHtml } from "@/lib/sanitize-html"

export async function generateStaticParams() {
  try {
    const slugs = await getArticleSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch {
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) return { title: "Статья не найдена" }

  return {
    title: article.metaTitle || `${article.title} | Журнал Millor Coffee`,
    description: article.metaDescription || article.excerpt,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      title: article.metaTitle || `${article.title} | Millor Coffee`,
      description: article.metaDescription || article.excerpt,
      images: article.coverImage ? [{ url: article.coverImage }] : undefined,
      type: "article",
      publishedTime: article.publishedAt?.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: article.metaTitle || `${article.title} | Millor Coffee`,
      description: article.metaDescription || article.excerpt,
      images: article.coverImage ? [article.coverImage] : undefined,
    },
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticleBySlug(slug)
  if (!article) notFound()

  // Fire-and-forget view count
  incrementArticleViewCount(article.id)

  const relatedArticles = await getRelatedArticles(article.id, article.categoryId, 3)

  // R3: расширенный Article schema для rich snippets в Google/Yandex.
  // Добавлено: mainEntityOfPage, author, publisher.logo, wordCount, keywords.
  const articleUrl = `https://millor-coffee.ru/blog/${slug}`
  const coverImageAbs = article.coverImage?.startsWith("http")
    ? article.coverImage
    : article.coverImage
      ? `https://millor-coffee.ru${article.coverImage}`
      : undefined
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    headline: article.title,
    description: article.excerpt,
    image: coverImageAbs,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.publishedAt?.toISOString(),
    author: {
      "@type": "Organization",
      name: "Millor Coffee",
      url: "https://millor-coffee.ru",
    },
    publisher: {
      "@type": "Organization",
      name: "Millor Coffee",
      logo: {
        "@type": "ImageObject",
        url: "https://millor-coffee.ru/apple-touch-icon.png",
      },
    },
    keywords: article.tags?.length ? article.tags.join(", ") : undefined,
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: "https://millor-coffee.ru" },
      { "@type": "ListItem", position: 2, name: "Блог", item: "https://millor-coffee.ru/blog" },
      { "@type": "ListItem", position: 3, name: article.title, item: `https://millor-coffee.ru/blog/${slug}` },
    ],
  }

  return (
    <>
      <Header />
      <main className="pt-16">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

        {/* Cover image */}
        {article.coverImage && (
          <div className="relative w-full h-48 sm:h-80 md:h-96 bg-muted">
            <Image
              src={article.coverImage}
              alt={article.title}
              fill
              className="object-cover"
              priority
            />
          </div>
        )}

        {/* Breadcrumbs */}
        <div className="bg-secondary/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground min-w-0">
              <Link href="/" className="hover:text-primary transition-colors shrink-0">Главная</Link>
              <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <Link href="/blog" className="hover:text-primary transition-colors shrink-0">Блог</Link>
              <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span className="text-foreground font-medium truncate min-w-0">{article.title}</span>
            </nav>
          </div>
        </div>

        {/* Article */}
        <article className="py-8 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
            {/* Meta line */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-5 sm:mb-6">
              {article.category && (
                <Link
                  href={`/blog?category=${article.category.slug}`}
                  className="px-2.5 py-1 bg-primary/10 text-primary rounded-md text-xs sm:text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  {article.category.name}
                </Link>
              )}
              {article.publishedAt && (
                <span className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  {new Date(article.publishedAt).toLocaleDateString("ru-RU", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
              <span className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {article.readingTime} мин чтения
              </span>
              <span className="flex items-center gap-1 text-xs sm:text-sm text-muted-foreground">
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {article.viewCount}
              </span>
            </div>

            {/* Title */}
            <h1 className="font-sans text-2xl sm:text-4xl md:text-5xl font-bold text-foreground mb-6 sm:mb-8 leading-tight">
              {article.title}
            </h1>

            {/* Content — HTML из TipTap-редактора санитизирован через DOMPurify,
                чтобы скомпрометированный админ или баг редактора не могли вкинуть
                script/iframe/on*-хендлеры через article.content. */}
            <div
              className="prose prose-base sm:prose-lg max-w-none prose-headings:font-sans prose-a:text-primary prose-img:rounded-lg break-words"
              dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(article.content) }}
            />

            {/* Tags */}
            {article.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t border-border">
                {article.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/blog?tag=${encodeURIComponent(tag)}`}
                    className="px-3 py-1.5 bg-secondary text-muted-foreground rounded-full text-sm hover:bg-secondary/80 transition-colors"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </article>

        {/* Related articles */}
        {relatedArticles.length > 0 && (
          <section className="py-8 sm:py-16 bg-secondary/30">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="font-sans text-xl sm:text-3xl font-bold text-foreground mb-5 sm:mb-8">
                Читайте также
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {relatedArticles.map((a) => (
                  <ArticleCard key={a.id} article={a} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </>
  )
}
