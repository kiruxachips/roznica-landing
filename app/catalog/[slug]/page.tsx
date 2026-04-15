export const dynamic = "force-dynamic"

import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { getProductBySlug, getRelatedProducts } from "@/lib/dal/products"
import { isProductFavorited } from "@/lib/dal/favorites"
import { auth } from "@/lib/auth"
import { FavoriteButton } from "@/components/account/FavoriteButton"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { ProductGallery } from "@/components/product/ProductGallery"
import { FlavorProfileBars } from "@/components/product/FlavorProfileBars"
import { FlavorNotes } from "@/components/product/FlavorNotes"
import { ProductClientSection } from "@/components/product/ProductClientSection"
import { ProductTabs } from "@/components/product/ProductTabs"
import { ProductCard } from "@/components/catalog/ProductCard"
import { Star } from "lucide-react"
import type { ProductType } from "@/lib/types"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: "Товар не найден" }

  const typeSuffix =
    product.productType === "tea" ? "купить чай" :
    product.productType === "instant" ? "растворимые напитки" :
    "купить кофе"

  return {
    title: product.metaTitle || `${product.name} — ${typeSuffix} | Millor Coffee`,
    description: product.metaDescription || product.description,
    alternates: { canonical: `/catalog/${slug}` },
    openGraph: {
      title: product.metaTitle || `${product.name} | Millor Coffee`,
      description: product.metaDescription || product.description,
      images: product.images[0]?.url ? [{ url: product.images[0].url }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: product.metaTitle || `${product.name} | Millor Coffee`,
      description: product.metaDescription || product.description,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

  const session = await auth()
  const isCustomer = (session?.user as Record<string, unknown>)?.userType === "customer"

  const [favorited, relatedProducts] = await Promise.all([
    isCustomer && session?.user?.id
      ? isProductFavorited(session.user.id, product.id)
      : Promise.resolve(false),
    getRelatedProducts(product.id, product.productType as ProductType, product.categoryId, 4),
  ])

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images[0]?.url,
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      price: v.price,
      priceCurrency: "RUB",
      availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    })),
    aggregateRating: product.reviews.length > 0
      ? {
          "@type": "AggregateRating",
          ratingValue: (product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length).toFixed(1),
          reviewCount: product.reviews.length,
        }
      : undefined,
  }

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Главная", item: "https://millor-coffee.ru" },
      { "@type": "ListItem", position: 2, name: "Каталог", item: "https://millor-coffee.ru/catalog" },
      { "@type": "ListItem", position: 3, name: product.name, item: `https://millor-coffee.ru/catalog/${slug}` },
    ],
  }

  const avgRating = product.reviews.length > 0
    ? Math.round((product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length) * 10) / 10
    : null

  return (
    <>
      <Header />
      <main className="pt-16">
        {/* JSON-LD */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

        {/* Breadcrumbs */}
        <div className="bg-secondary/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            {(() => {
              const typeLabel =
                product.productType === "tea" ? "Чай" :
                product.productType === "instant" ? "Растворимая продукция" :
                "Кофе"
              const typeHref =
                product.productType === "tea" ? "/catalog?type=tea" :
                product.productType === "instant" ? "/catalog?type=instant" :
                "/catalog?type=coffee"
              return (
                <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground overflow-x-auto whitespace-nowrap">
                  <Link href="/" className="hover:text-primary transition-colors">Главная</Link>
                  <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <Link href={typeHref} className="hover:text-primary transition-colors">{typeLabel}</Link>
                  <ChevronRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span className="text-foreground font-medium truncate">{product.name}</span>
                </nav>
              )
            })()}
          </div>
        </div>

        {/* Product section */}
        <section className="py-6 sm:py-10 pb-24 sm:pb-10">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-12">
              {/* Gallery — sticky on desktop */}
              <div className="lg:col-span-5 lg:sticky lg:top-20 lg:self-start">
                <ProductGallery images={product.images} productName={product.name} />
              </div>

              {/* Info */}
              <div className="lg:col-span-7 space-y-5 sm:space-y-6">
                {/* Badge */}
                {product.badge && (
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {product.badge}
                  </span>
                )}

                {/* Name */}
                <div className="flex items-start gap-3">
                  <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground flex-1 leading-tight">
                    {product.name}
                  </h1>
                  {isCustomer && (
                    <FavoriteButton
                      productId={product.id}
                      isFavorited={favorited}
                      className="mt-1.5 w-10 h-10"
                    />
                  )}
                </div>

                {/* Rating */}
                {avgRating && (
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {Array.from({ length: Math.round(avgRating) }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {avgRating} ({product.reviews.length} отзывов)
                    </span>
                  </div>
                )}

                {/* Short description */}
                <p className="text-muted-foreground leading-relaxed">
                  {product.description}
                </p>

                {/* Flavor notes */}
                {product.flavorNotes.length > 0 && <FlavorNotes notes={product.flavorNotes} />}

                {/* Flavor profile — coffee only */}
                {product.productType === "coffee" && (product.acidity !== null || product.sweetness !== null) && (
                  <FlavorProfileBars
                    acidity={product.acidity}
                    sweetness={product.sweetness}
                    bitterness={product.bitterness}
                    body={product.body}
                  />
                )}

                {/* Weight selector + trust signals + sticky CTA */}
                {product.variants.length > 0 && (
                  <ProductClientSection
                    variants={product.variants}
                    productId={product.id}
                    productName={product.name}
                    productSlug={product.slug}
                    productImage={product.images.find((i) => i.isPrimary)?.url ?? product.images[0]?.url ?? null}
                  />
                )}
              </div>
            </div>

            {/* Tabs: Description / Meta / Reviews */}
            <ProductTabs
              productType={product.productType}
              productForm={product.productForm}
              fullDescription={product.fullDescription}
              origin={product.origin}
              region={product.region}
              altitude={product.altitude}
              roastLevel={product.roastLevel}
              processingMethod={product.processingMethod}
              farm={product.farm}
              brewingMethods={product.brewingMethods}
              reviews={product.reviews}
            />

            {/* Related products */}
            {relatedProducts.length > 0 && (
              <div className="mt-14 sm:mt-20">
                <h2 className="font-serif text-xl sm:text-2xl font-bold mb-6">С этим также покупают</h2>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {relatedProducts.map((p) => (
                    <ProductCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
