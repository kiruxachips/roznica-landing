import Link from "next/link"
import { Metadata } from "next"
import { getProducts, getFilterOptions } from "@/lib/dal/products"
import { getCollectionsWithProducts } from "@/lib/dal/collections"
import { getFavoriteProductIds } from "@/lib/dal/favorites"
import { auth } from "@/lib/auth"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { BackToTop } from "@/components/ui/back-to-top"
import { FilterBar } from "@/components/catalog/FilterBar"
import { ProductGrid } from "@/components/catalog/ProductGrid"
import { EmptyState } from "@/components/catalog/EmptyState"
import { CollectionSection } from "@/components/catalog/CollectionSection"
import type { ProductType } from "@/lib/types"

const TYPE_TITLES: Record<string, string> = {
  coffee: "Кофе",
  tea: "Чай",
  instant: "Растворимая продукция",
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; q?: string }>
}): Promise<Metadata> {
  const params = await searchParams
  const page = Number(params.page) || 1
  // Default tab is coffee when no ?type param is present — matches the UI.
  const typeLabel = TYPE_TITLES[params.type ?? "coffee"] ?? "Каталог"
  const title = params.q
    ? `Поиск: «${params.q}» | Millor Coffee`
    : `${typeLabel} — каталог | Millor Coffee`
  const canonical = page > 1 ? `/catalog?page=${page}` : "/catalog"

  return {
    title,
    description: "Свежеобжаренный кофе, чай и растворимые напитки. Доставка по России.",
    alternates: { canonical },
  }
}

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; roast?: string; origin?: string; brewing?: string; teaType?: string; form?: string; sort?: string; page?: string; collection?: string }>
}) {
  const params = await searchParams
  const rawType = params.type
  // Catalog defaults to the coffee tab — the UI highlights "Кофе" when no
  // ?type param is set, so the DAL query must agree to avoid tea/instant
  // products leaking into the default coffee view.
  const productType: ProductType =
    rawType === "tea" || rawType === "instant" ? rawType : "coffee"

  const filters = {
    productType,
    roastLevel: params.roast,
    origin: params.origin,
    brewingMethod: params.brewing,
    teaType: params.teaType,
    productForm: params.form,
    collectionSlug: params.collection,
    search: params.q,
    sort: params.sort as "price-asc" | "price-desc" | "newest" | "popular" | undefined,
    page: Number(params.page) || 1,
    limit: 12,
  }

  const hasActiveFilters = !!(params.roast || params.origin || params.brewing || params.teaType || params.form || params.collection || params.sort || params.q)
  const showCollections = !hasActiveFilters && productType === "coffee"

  const session = await auth()
  const isCustomer = (session?.user as Record<string, unknown>)?.userType === "customer"

  // When showing collections we render the curated sections only — skip the
  // flat product grid fetch entirely so the default coffee view doesn't
  // double-render every product.
  const [gridResult, filterOptions, favIds, collections] = await Promise.all([
    showCollections
      ? Promise.resolve({ products: [], total: 0 })
      : getProducts(filters),
    getFilterOptions(productType),
    isCustomer && session?.user?.id
      ? getFavoriteProductIds(session.user.id)
      : Promise.resolve([]),
    showCollections ? getCollectionsWithProducts() : Promise.resolve([]),
  ])
  const { products, total } = gridResult

  const favoriteIds = isCustomer ? favIds : undefined
  const favoriteSet = favoriteIds ? new Set(favoriteIds) : undefined
  const totalPages = Math.ceil(total / 12)

  const heading = params.q
    ? `Результаты поиска: «${params.q}»`
    : productType ? (TYPE_TITLES[productType] ?? "Каталог") : "Каталог"
  // Count label makes sense only when the flat grid is on screen — when
  // collections are showcased instead, each section has its own count.
  const countLabel = showCollections
    ? null
    : total === 1 ? "1 товар" : total < 5 ? `${total} товара` : `${total} товаров`

  return (
    <>
      <Header />
      <main className="pt-16">
        <section className="py-4 sm:py-6">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            {/* H1 для SEO/доступности (визуально скрыт): таб «Кофе/Чай/
                Растворимая» в FilterBar уже выполняет роль заголовка раздела,
                а дублирующий H1 сверху создавал визуальный шум. */}
            <h1 className="sr-only">{heading}</h1>
            {countLabel && (
              <p className="mb-3 sm:mb-4 text-xs sm:text-sm text-muted-foreground">
                {countLabel}
              </p>
            )}

            <FilterBar
              filterOptions={filterOptions}
              activeType={productType}
              activeRoast={params.roast}
              activeOrigin={params.origin}
              activeBrewing={params.brewing}
              activeTeaType={params.teaType}
              activeForm={params.form}
              activeSort={params.sort}
              activeSearch={params.q}
            />

            {/* Active collection filter label */}
            {params.collection && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Подборка:</span>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  {params.collection}
                </span>
                <Link href={productType ? `/catalog?type=${productType}` : "/catalog"} className="text-xs text-muted-foreground hover:text-foreground">Сбросить</Link>
              </div>
            )}

            {showCollections ? (
              // Default coffee view: curated collection carousels only, no
              // flat grid below (would duplicate every product).
              collections.length > 0 ? (
                <div className="mt-2">
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
              ) : (
                <EmptyState />
              )
            ) : products.length > 0 ? (
              <ProductGrid
                key={`${productType ?? "all"}|${params.q ?? ""}|${params.roast ?? ""}|${params.origin ?? ""}|${params.brewing ?? ""}|${params.teaType ?? ""}|${params.form ?? ""}|${params.collection ?? ""}|${params.sort ?? ""}`}
                products={products}
                currentPage={filters.page}
                totalPages={totalPages}
                favoriteIds={favoriteIds}
                searchParams={params}
              />
            ) : (
              <EmptyState />
            )}
          </div>
        </section>
      </main>
      <Footer />
      <BackToTop />
    </>
  )
}
