import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Heart } from "lucide-react"
import { auth } from "@/lib/auth"
import { getFavoritesByUserId } from "@/lib/dal/favorites"
import { ProductCard } from "@/components/catalog/ProductCard"
import type { ProductCard as ProductCardType } from "@/lib/types"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Избранное | Millor Coffee",
}

function toProductCard(product: {
  id: string
  name: string
  slug: string
  description: string
  origin: string | null
  roastLevel: string | null
  badge: string | null
  flavorNotes: string[]
  images: { url: string; alt: string | null }[]
  variants: { id: string; weight: string; price: number; oldPrice: number | null; stock: number }[]
  reviews: { rating: number }[]
}): ProductCardType {
  const avgRating = product.reviews.length > 0
    ? product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length
    : null

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    origin: product.origin,
    roastLevel: product.roastLevel,
    badge: product.badge,
    flavorNotes: product.flavorNotes,
    primaryImage: product.images[0]?.url ?? null,
    primaryImageAlt: product.images[0]?.alt ?? null,
    minPrice: product.variants[0]?.price ?? null,
    minOldPrice: product.variants[0]?.oldPrice ?? null,
    firstVariant: product.variants[0] ? { id: product.variants[0].id, weight: product.variants[0].weight, price: product.variants[0].price, oldPrice: product.variants[0].oldPrice, stock: product.variants[0].stock } : null,
    reviewCount: product.reviews.length,
    averageRating: avgRating,
  }
}

export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const params = await searchParams
  const page = Number(params.page) || 1
  const { favorites, total } = await getFavoritesByUserId(session.user.id, { page, limit: 12 })
  const totalPages = Math.ceil(total / 12)

  return (
    <div>
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h1 className="text-xl font-serif font-bold">Избранное</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {total > 0 ? `${total} товаров` : "Пока пусто"}
        </p>
      </div>

      {favorites.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4">
            {favorites.map((fav) => (
              <ProductCard
                key={fav.id}
                product={toProductCard(fav.product)}
                favorited
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={`/account/favorites?page=${p}`}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium transition-colors ${
                    p === page
                      ? "bg-primary text-primary-foreground"
                      : "bg-white text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">
            Вы ещё не добавили товары в избранное
          </p>
          <Link
            href="/catalog"
            className="inline-flex h-10 px-6 items-center rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Перейти в каталог
          </Link>
        </div>
      )}
    </div>
  )
}
