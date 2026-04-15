import Link from "next/link"
import { Metadata } from "next"
import { getProducts, getFilterOptions } from "@/lib/dal/products"
import { getCollectionsWithProducts } from "@/lib/dal/collections"
import { getFavoriteProductIds } from "@/lib/dal/favorites"
import { auth } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { FilterBar } from "@/components/catalog/FilterBar"
import { ProductGrid } from "@/components/catalog/ProductGrid"
import { EmptyState } from "@/components/catalog/EmptyState"
import { CollectionSection } from "@/components/catalog/CollectionSection"

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}): Promise<Metadata> {
  const params = await searchParams
  const page = Number(params.page) || 1
  const canonical = page > 1 ? `/catalog?page=${page}` : "/catalog"

  return {
    title: "Каталог свежеобжаренного кофе | Millor Coffee",
    description: "Выберите свежеобжаренный кофе в зёрнах для дома. Арабика из Бразилии, Перу, Эфиопии. Доставка по России.",
    alternates: { canonical },
  }
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ roast?: string; origin?: string; brewing?: string; sort?: string; page?: string; collection?: string }>
}) {
  const params = await searchParams
  const filters = {
    roastLevel: params.roast,
    origin: params.origin,
    brewingMethod: params.brewing,
    collectionSlug: params.collection,
    sort: params.sort as "price-asc" | "price-desc" | "newest" | "popular" | undefined,
    page: Number(params.page) || 1,
    limit: 12,
  }

  const hasActiveFilters = !!(params.roast || params.origin || params.brewing || params.collection || params.sort)

  const session = await auth()
  const isCustomer = (session?.user as Record<string, unknown>)?.userType === "customer"

  const [{ products, total }, filterOptions, favIds, collections] = await Promise.all([
    getProducts(filters),
    getFilterOptions(),
    isCustomer && session?.user?.id
      ? getFavoriteProductIds(session.user.id)
      : Promise.resolve([]),
    !hasActiveFilters ? getCollectionsWithProducts() : Promise.resolve([]),
  ])

  const favoriteIds = isCustomer ? favIds : undefined
  const favoriteSet = favoriteIds ? new Set(favoriteIds) : undefined
  const totalPages = Math.ceil(total / 12)

  return (
    <>
      <Header />
      <main className="pt-16">
        <section className="py-6 sm:py-10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-5 sm:mb-6">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold">Каталог кофе</h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">{total} сортов в наличии</p>
            </div>

            {/* Collection showcase sections — only when no filters active */}
            {!hasActiveFilters && collections.length > 0 && (
              <div className="mb-10">
                {collections.map((c) => (
                  <CollectionSection
                    key={c.id}
                    name={c.name}
                    slug={c.slug}
                    emoji={c.emoji}
                    products={c.products}
                    favoritedIds={favoriteSet}
                  />
                ))}
              </div>
            )}

            {/* Active collection filter label */}
            {params.collection && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Подборка:</span>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  {params.collection}
                </span>
                <Link href="/catalog" className="text-xs text-muted-foreground hover:text-foreground">Сбросить</Link>
              </div>
            )}

            <FilterBar
              filterOptions={filterOptions}
              activeRoast={params.roast}
              activeOrigin={params.origin}
              activeBrewing={params.brewing}
              activeSort={params.sort}
            />

            {products.length > 0 ? (
              <ProductGrid products={products} currentPage={filters.page} totalPages={totalPages} favoriteIds={favoriteIds} searchParams={params} />
            ) : (
              <EmptyState />
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
