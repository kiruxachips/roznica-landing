/**
 * Централизованная карта тегов для Next.js unstable_cache / revalidateTag.
 * Используется DAL-функциями (чтобы объявить tags) и server actions
 * (чтобы точечно инвалидировать кэш вместо широкого revalidatePath("/")).
 */
export const CACHE_TAGS = {
  products: "products",
  product: (slug: string) => `product:${slug}`,
  catalog: "catalog",
  homepage: "homepage",
  filters: "catalog-filters",
  stats: "shop-stats",
  articles: "articles",
  article: (slug: string) => `article:${slug}`,
  collections: "collections",
  sitemap: "sitemap",
  gifts: "gifts",
  // Wholesale — отдельные теги, чтобы инвалидация розницы не перебивала оптовый кеш и наоборот.
  wholesaleCatalog: (priceListId: string) => `wholesale:catalog:${priceListId}`,
  wholesaleCompany: (companyId: string) => `wholesale:company:${companyId}`,
  wholesalePriceList: (priceListId: string) => `wholesale:pricelist:${priceListId}`,
} as const
