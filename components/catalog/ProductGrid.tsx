import Link from "next/link"
import { ProductCard } from "./ProductCard"
import type { ProductCard as ProductCardType } from "@/lib/types"

interface ProductGridProps {
  products: ProductCardType[]
  currentPage: number
  totalPages: number
  favoriteIds?: Set<string>
}

export function ProductGrid({ products, currentPage, totalPages, favoriteIds }: ProductGridProps) {
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            favorited={favoriteIds ? favoriteIds.has(product.id) : undefined}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-16">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              href={`/catalog?page=${page}`}
              className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                page === currentPage
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {page}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
