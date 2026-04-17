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

  const [{ products, total }, filterOptions, favIds, collections] = await Promise.all([
    getProducts(filters),
    getFilterOptions(productType),
    isCustomer && session?.user?.id
      ? getFavoriteProductIds(session.user.id)
      : Promise.resolve([]),
    showCollections ? getCollectionsWithProducts() : Promise.resolve([]),
  ])

  const favoriteIds = isCustomer ? favIds : undefined
  const favoriteSet = favoriteIds ? new Set(favoriteIds) : undefined
  const totalPages = Math.ceil(total / 12)

  const heading = params.q
    ? `Результаты поиска: «${params.q}»`
    : productType ? (TYPE_TITLES[productType] ?? "Каталог") : "Каталог"
  const countLabel = total === 1 ? "1 товар" : total < 5 ? `${total} товара` : `${total} товаров`

  return (
    <>
      <Header />
      <main className="pt-16">
        <section className="py-4 sm:py-6">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-3 sm:mb-4 flex items-baseline gap-3">
              <h1 className="font-serif text-xl sm:text-2xl font-bold">{heading}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">{countLabel}</p>
            </div>

            {/* Collection showcase sections — only for coffee tab when no filters active */}
            {showCollections && collections.length > 0 && (
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
                <Link href={productType ? `/catalog?type=${productType}` : "/catalog"} className="text-xs text-muted-foreground hover:text-foreground">Сбросить</Link>
              </div>
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

            {products.length > 0 ? (
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
    </>
  )
}
