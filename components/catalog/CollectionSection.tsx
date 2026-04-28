"use client"

import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { ProductCard } from "./ProductCard"
import { useDragScroll } from "@/lib/hooks/use-drag-scroll"
import { cn } from "@/lib/utils"
import type { ProductCard as ProductCardType } from "@/lib/types"

interface Props {
  name: string
  slug: string
  emoji: string | null
  products: ProductCardType[]
  favoritedIds?: Set<string>
}

const CARD_STEP = 296

export function CollectionSection({ name, slug, emoji, products, favoritedIds }: Props) {
  const { ref, canScrollLeft, canScrollRight, scrollByAmount } =
    useDragScroll<HTMLDivElement>()

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
      {/* Wrapper-расширение до краёв контейнера: -mx с lg-вариантом обязателен,
          иначе на больших экранах скролл стартует с sm:px-6 (24px), а заголовок
          с lg:px-8 (32px) — карточки визуально «уже пролистаны». */}
      <div className="group relative -mx-4 sm:-mx-6 lg:-mx-8">
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-12 bg-gradient-to-r from-background via-background/80 to-transparent sm:block transition-opacity duration-200",
            canScrollLeft ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-10 hidden w-12 bg-gradient-to-l from-background via-background/80 to-transparent sm:block transition-opacity duration-200",
            canScrollRight ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Стрелки навигации — только десктоп/планшет. Размер 28px, прижаты
            к самому краю wrapper'а: wrapper выходит за контент на 16/24/32px
            (-mx-4/-mx-6/-mx-8), стрелка занимает 28px от left-0 — итого
            заканчивается до того, как начинается первая карточка, не
            перекрывает её. */}
        <button
          type="button"
          onClick={() => scrollByAmount(-CARD_STEP)}
          aria-label="Прокрутить влево"
          className={cn(
            "hidden sm:flex absolute left-0 top-[35%] -translate-y-1/2 z-20",
            "w-7 h-7 rounded-full bg-white shadow-md border border-border",
            "items-center justify-center text-foreground hover:bg-secondary hover:scale-105",
            "transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            canScrollLeft
              ? "opacity-80 group-hover:opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          )}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => scrollByAmount(CARD_STEP)}
          aria-label="Прокрутить вправо"
          className={cn(
            "hidden sm:flex absolute right-0 top-[35%] -translate-y-1/2 z-20",
            "w-7 h-7 rounded-full bg-white shadow-md border border-border",
            "items-center justify-center text-foreground hover:bg-secondary hover:scale-105",
            "transition-all duration-200",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
            canScrollRight
              ? "opacity-80 group-hover:opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          )}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <div
          ref={ref}
          className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory px-4 sm:px-6 lg:px-8 sm:cursor-grab"
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
