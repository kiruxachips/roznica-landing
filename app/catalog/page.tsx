export const dynamic = "force-dynamic"

import { Metadata } from "next"
import { getProducts, getFilterOptions } from "@/lib/dal/products"
import { getFavoriteProductIds } from "@/lib/dal/favorites"
import { auth } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { CatalogHero } from "@/components/catalog/CatalogHero"
import { FilterBar } from "@/components/catalog/FilterBar"
import { ProductGrid } from "@/components/catalog/ProductGrid"
import { EmptyState } from "@/components/catalog/EmptyState"

export const metadata: Metadata = {
  title: "Каталог свежеобжаренного кофе | Millor Coffee",
  description: "Выберите свежеобжаренный кофе в зёрнах для дома. Арабика из Бразилии, Перу, Эфиопии. Доставка по России.",
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ roast?: string; origin?: string; brewing?: string; sort?: string; page?: string }>
}) {
  const params = await searchParams
  const filters = {
    roastLevel: params.roast,
    origin: params.origin,
    brewingMethod: params.brewing,
    sort: params.sort as "price-asc" | "price-desc" | "newest" | "popular" | undefined,
    page: Number(params.page) || 1,
    limit: 12,
  }

  const session = await auth()
  const isCustomer = (session?.user as Record<string, unknown>)?.userType === "customer"

  const [{ products, total }, filterOptions, favIds] = await Promise.all([
    getProducts(filters),
    getFilterOptions(),
    isCustomer && session?.user?.id
      ? getFavoriteProductIds(session.user.id)
      : Promise.resolve([]),
  ])

  const favoriteIds = isCustomer ? new Set(favIds) : undefined
  const totalPages = Math.ceil(total / 12)

  return (
    <>
      <Header />
      <main className="pt-16">
        <CatalogHero />

        <section className="py-12 sm:py-16">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <FilterBar
              filterOptions={filterOptions}
              activeRoast={params.roast}
              activeOrigin={params.origin}
              activeBrewing={params.brewing}
              activeSort={params.sort}
            />

            {products.length > 0 ? (
              <ProductGrid products={products} currentPage={filters.page} totalPages={totalPages} favoriteIds={favoriteIds} />
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
