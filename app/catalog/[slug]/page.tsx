export const dynamic = "force-dynamic"

import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { getProductBySlug, getProductSlugs } from "@/lib/dal/products"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { ProductGallery } from "@/components/product/ProductGallery"
import { FlavorProfileBars } from "@/components/product/FlavorProfileBars"
import { BrewingMethods } from "@/components/product/BrewingMethods"
import { FlavorNotes } from "@/components/product/FlavorNotes"
import { WeightSelector } from "@/components/product/WeightSelector"
import { ProductMeta } from "@/components/product/ProductMeta"
import { ReviewsList } from "@/components/product/ReviewsList"
import { Star } from "lucide-react"

export async function generateStaticParams() {
  try {
    const slugs = await getProductSlugs()
    return slugs.map((slug) => ({ slug }))
  } catch {
    // DB not available during build, return empty for on-demand generation
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) return { title: "Товар не найден" }

  return {
    title: product.metaTitle || `${product.name} — купить кофе | Millor Coffee`,
    description: product.metaDescription || product.description,
    openGraph: {
      title: product.metaTitle || `${product.name} | Millor Coffee`,
      description: product.metaDescription || product.description,
      images: product.images[0]?.url ? [{ url: product.images[0].url }] : undefined,
    },
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const product = await getProductBySlug(slug)
  if (!product) notFound()

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

  const avgRating = product.reviews.length > 0
    ? Math.round((product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length) * 10) / 10
    : null

  return (
    <>
      <Header />
      <main className="pt-16">
        {/* JSON-LD */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        {/* Breadcrumbs */}
        <div className="bg-secondary/30">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-primary transition-colors">Главная</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link href="/catalog" className="hover:text-primary transition-colors">Каталог</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium">{product.name}</span>
            </nav>
          </div>
        </div>

        {/* Product section */}
        <section className="py-12 sm:py-16 lg:py-24">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12">
              {/* Gallery */}
              <div className="lg:col-span-5">
                <ProductGallery images={product.images} productName={product.name} />
              </div>

              {/* Info */}
              <div className="lg:col-span-7 space-y-6">
                {/* Badge */}
                {product.badge && (
                  <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                    {product.badge}
                  </span>
                )}

                {/* Name */}
                <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground">
                  {product.name}
                </h1>

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
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {product.description}
                </p>

                {/* Meta info */}
                <ProductMeta
                  origin={product.origin}
                  region={product.region}
                  altitude={product.altitude}
                  roastLevel={product.roastLevel}
                  processingMethod={product.processingMethod}
                  farm={product.farm}
                />

                {/* Flavor notes */}
                {product.flavorNotes.length > 0 && <FlavorNotes notes={product.flavorNotes} />}

                {/* Flavor profile */}
                {(product.acidity !== null || product.sweetness !== null) && (
                  <FlavorProfileBars
                    acidity={product.acidity}
                    sweetness={product.sweetness}
                    bitterness={product.bitterness}
                    body={product.body}
                  />
                )}

                {/* Brewing methods */}
                {product.brewingMethods.length > 0 && <BrewingMethods methods={product.brewingMethods} />}

                {/* Weight selector + price + add to cart */}
                {product.variants.length > 0 && (
                  <WeightSelector
                    variants={product.variants}
                    productId={product.id}
                    productName={product.name}
                    productSlug={product.slug}
                    productImage={product.images.find((i) => i.isPrimary)?.url ?? product.images[0]?.url ?? null}
                  />
                )}
              </div>
            </div>

            {/* Full description */}
            {product.fullDescription && (
              <div className="mt-16 sm:mt-24 max-w-3xl">
                <h2 className="font-serif text-2xl font-bold mb-6">О кофе</h2>
                <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {product.fullDescription}
                </div>
              </div>
            )}

            {/* Reviews */}
            {product.reviews.length > 0 && (
              <div className="mt-16 sm:mt-24">
                <ReviewsList reviews={product.reviews} />
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
