import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Heart } from "lucide-react"
import { auth } from "@/lib/auth"
import { getFavoritesByUserId } from "@/lib/dal/favorites"
import { mapToProductCard } from "@/lib/dal/products"
import { ProductCard } from "@/components/catalog/ProductCard"
import { paginateRange } from "@/lib/utils"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Избранное | Millor Coffee",
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
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 mb-5 sm:mb-6">
        <h1 className="text-lg sm:text-xl font-sans font-bold">Избранное</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {total > 0 ? `${total} товаров` : "Пока пусто"}
        </p>
      </div>

      {favorites.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-4">
            {favorites.map((fav) => (
              <ProductCard
                key={fav.id}
                product={mapToProductCard(fav.product)}
                favorited
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav aria-label="Пагинация избранного" className="flex flex-wrap justify-center gap-2 mt-8">
              {paginateRange(page, totalPages).map((p, i) =>
                p === "..." ? (
                  <span
                    key={`ellipsis-${i}`}
                    aria-hidden="true"
                    className="w-10 h-10 flex items-center justify-center text-sm text-muted-foreground"
                  >
                    …
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={`/account/favorites?page=${p}`}
                    aria-label={`Страница ${p}`}
                    aria-current={p === page ? "page" : undefined}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                      p === page
                        ? "bg-primary text-primary-foreground"
                        : "bg-white text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {p}
                  </Link>
                )
              )}
            </nav>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-12 text-center">
          <Heart className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/30 mx-auto mb-4" />
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
