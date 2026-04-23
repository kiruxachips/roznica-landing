"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { ProductCard } from "./ProductCard"
import { useDragScroll } from "@/lib/hooks/use-drag-scroll"
import type { ProductCard as ProductCardType } from "@/lib/types"

interface Props {
  name: string
  slug: string
  emoji: string | null
  products: ProductCardType[]
  favoritedIds?: Set<string>
}

export function CollectionSection({ name, slug, emoji, products, favoritedIds }: Props) {
  const scrollRef = useDragScroll<HTMLDivElement>()

  if (products.length === 0) return null

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-sans text-xl font-bold">
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
      {/* Relative wrapper для fade-градиентов по краям, намекающих на прокрутку.
          Градиенты видны только на десктопе — на мобиле нативный свайп делает
          подсказку лишней. */}
      <div className="relative -mx-4 sm:-mx-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-6 bg-gradient-to-r from-background to-transparent sm:block" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-6 bg-gradient-to-l from-background to-transparent sm:block" />
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory px-4 sm:px-6 sm:cursor-grab"
        >
          {products.map((product) => (
            <div key={product.id} className="snap-start shrink-0 w-[260px] sm:w-[280px]">
              <ProductCard
                product={product}
                favorited={favoritedIds ? favoritedIds.has(product.id) : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
