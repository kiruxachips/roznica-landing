import { MetadataRoute } from "next"
import { getProductSlugs } from "@/lib/dal/products"
import { getArticleSlugs } from "@/lib/dal/articles"

const BASE_URL = "https://millor-coffee.ru"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/catalog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/privacy`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: `${BASE_URL}/terms`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ]

  let productPages: MetadataRoute.Sitemap = []
  let articlePages: MetadataRoute.Sitemap = []

  try {
    const productSlugs = await getProductSlugs()
    productPages = productSlugs.map((slug) => ({
      url: `${BASE_URL}/catalog/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))
  } catch {
    // DB unavailable — return static pages only
  }

  try {
    const articleSlugs = await getArticleSlugs()
    articlePages = articleSlugs.map((slug) => ({
      url: `${BASE_URL}/blog/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }))
  } catch {
    // DB unavailable — return static pages only
  }

  return [...staticPages, ...productPages, ...articlePages]
}
