"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2 } from "lucide-react"
import { ProductCard } from "./ProductCard"
import type { ProductCard as ProductCardType } from "@/lib/types"

interface ProductGridProps {
  products: ProductCardType[]
  currentPage: number
  totalPages: number
  favoriteIds?: string[]
  searchParams?: Record<string, string | undefined>
}

export function ProductGrid({
  products: initialProducts,
  currentPage,
  totalPages,
  favoriteIds,
  searchParams,
}: ProductGridProps) {
  const [items, setItems] = useState(initialProducts)
  const [page, setPage] = useState(currentPage)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(currentPage < totalPages)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Build a Set for O(1) favorited lookup
  const favoriteSet = useMemo(
    () => (favoriteIds ? new Set(favoriteIds) : undefined),
    [favoriteIds]
  )

  // Stabilize searchParams: hashing to a string prevents re-renders triggered
  // by parents passing a new object reference with identical values.
  const baseQuery = useMemo(() => {
    if (!searchParams) return ""
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "page") params.set(key, value)
    }
    return params.toString()
  }, [searchParams])

  // Reset state whenever the server-rendered first page changes
  // (happens when filters/sort/collection in URL change)
  useEffect(() => {
    setItems(initialProducts)
    setPage(currentPage)
    setHasMore(currentPage < totalPages)
  }, [initialProducts, currentPage, totalPages])

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoading(true)
    try {
      const next = page + 1
      const url = baseQuery
        ? `/api/catalog/products?${baseQuery}&page=${next}`
        : `/api/catalog/products?page=${next}`

      const res = await fetch(url)
      if (!res.ok) throw new Error("bad response")
      const data = (await res.json()) as {
        products: ProductCardType[]
        hasMore: boolean
      }

      setItems((prev) => [...prev, ...data.products])
      setPage(next)
      setHasMore(data.hasMore)
    } catch {
      // swallow — user can retry by scrolling or clicking
    } finally {
      setLoading(false)
    }
  }, [loading, hasMore, page, baseQuery])

  // IntersectionObserver on sentinel for auto-load
  useEffect(() => {
    if (!hasMore || loading) return
    const el = sentinelRef.current
    if (!el) return

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore()
      },
      { rootMargin: "400px 0px" }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasMore, loading, loadMore])

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
        {items.map((product, i) => (
          <ProductCard
            key={product.id}
            product={product}
            favorited={favoriteSet ? favoriteSet.has(product.id) : undefined}
            priority={i < 4}
          />
        ))}
      </div>

      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex flex-col items-center justify-center py-10"
        >
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={1.75} />
              Загружаем ещё...
            </div>
          ) : (
            <button
              onClick={loadMore}
              className="h-11 px-6 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Показать ещё
            </button>
          )}
        </div>
      )}

      {!hasMore && items.length > 12 && (
        <p className="text-center text-xs sm:text-sm text-muted-foreground py-6">
          Это все сорта. {items.length} {items.length === 1 ? "товар" : items.length < 5 ? "товара" : "товаров"}.
        </p>
      )}
    </div>
  )
}
