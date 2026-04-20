import { prisma } from "@/lib/prisma"
import type { ArticleCard, ArticleDetail, ArticleFilters } from "@/lib/types"
import { Prisma } from "@prisma/client"
import { unstable_cache } from "next/cache"
import { CACHE_TAGS } from "@/lib/cache-tags"

export function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim()
  const wordCount = text.split(" ").filter(Boolean).length
  return Math.max(1, Math.ceil(wordCount / 200))
}

// Listings need content only to compute readingTime; everything else stays out
const articleCardSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  tags: true,
  publishedAt: true,
  content: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ArticleSelect

export async function getArticles(filters: ArticleFilters = {}): Promise<{
  articles: ArticleCard[]
  total: number
}> {
  const { categorySlug, tag, search, page = 1, limit = 9 } = filters

  const where: Prisma.ArticleWhereInput = {
    isPublished: true,
  }

  if (categorySlug) {
    where.category = { slug: categorySlug }
  }
  if (tag) {
    where.tags = { has: tag }
  }
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { excerpt: { contains: search, mode: "insensitive" } },
    ]
  }

  const [items, total] = await Promise.all([
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: articleCardSelect,
    }),
    prisma.article.count({ where }),
  ])

  const articles: ArticleCard[] = items.map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    coverImage: a.coverImage,
    category: a.category,
    tags: a.tags,
    publishedAt: a.publishedAt,
    readingTime: estimateReadingTime(a.content),
  }))

  return { articles, total }
}

export async function getArticleBySlug(slug: string): Promise<ArticleDetail | null> {
  const article = await prisma.article.findUnique({
    where: { slug, isPublished: true },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      content: true,
      coverImage: true,
      categoryId: true,
      tags: true,
      publishedAt: true,
      viewCount: true,
      metaTitle: true,
      metaDescription: true,
      category: { select: { name: true, slug: true } },
    },
  })

  if (!article) return null

  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    content: article.content,
    coverImage: article.coverImage,
    category: article.category,
    categoryId: article.categoryId,
    tags: article.tags,
    publishedAt: article.publishedAt,
    viewCount: article.viewCount,
    readingTime: estimateReadingTime(article.content),
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
  }
}

export const getArticleSlugs = unstable_cache(
  async (): Promise<string[]> => {
    const articles = await prisma.article.findMany({
      where: { isPublished: true },
      select: { slug: true },
    })
    return articles.map((a) => a.slug)
  },
  ["article-slugs"],
  { revalidate: 86400, tags: [CACHE_TAGS.articles, CACHE_TAGS.sitemap] }
)

export async function getRelatedArticles(articleId: string, categoryId: string | null, limit = 3): Promise<ArticleCard[]> {
  const where: Prisma.ArticleWhereInput = {
    isPublished: true,
    id: { not: articleId },
  }
  if (categoryId) {
    where.categoryId = categoryId
  }

  const items = await prisma.article.findMany({
    where,
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: articleCardSelect,
  })

  return items.map((a) => ({
    id: a.id,
    title: a.title,
    slug: a.slug,
    excerpt: a.excerpt,
    coverImage: a.coverImage,
    category: a.category,
    tags: a.tags,
    publishedAt: a.publishedAt,
    readingTime: estimateReadingTime(a.content),
  }))
}

export async function incrementArticleViewCount(id: string) {
  try {
    await prisma.article.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    })
  } catch {
    // fire-and-forget
  }
}
