"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { ProductCard } from "./ProductCard"
import type { ProductCard as ProductCardType } from "@/lib/types"

interface Props {
  name: string
  slug: string
  emoji: string | null
  products: ProductCardType[]
  favoritedIds?: Set<string>
}

export function CollectionSection({ name, slug, emoji, products, favoritedIds }: Props) {
  if (products.length === 0) return null

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-xl font-bold">
          {emoji && <span className="mr-2">{emoji}</span>}
          {name}
        </h2>
        <Link
          href={`/catalog?collection=${slug}`}
          className="text-sm text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors"
        >
          Смотреть все
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory -mx-4 px-4 sm:-mx-6 sm:px-6">
        {products.map((product) => (
          <div key={product.id} className="snap-start shrink-0 w-[260px] sm:w-[280px]">
            <ProductCard
              product={product}
              favorited={favoritedIds ? favoritedIds.has(product.id) : undefined}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
