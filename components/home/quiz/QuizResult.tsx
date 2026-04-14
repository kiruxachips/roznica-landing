"use client"

import Link from "next/link"
import { RotateCcw, ArrowRight, Sparkles } from "lucide-react"
import { ProductCard } from "@/components/catalog/ProductCard"
import type { ProductCard as ProductCardType } from "@/lib/types"

interface Match {
  productId: string
  score: number
}

interface QuizResultProps {
  products: ProductCardType[]
  matches: Match[]
  onRestart: () => void
}

export function QuizResult({ products, matches, onRestart }: QuizResultProps) {
  const matchMap = new Map(matches.map((m) => [m.productId, m.score]))

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Пока не удалось подобрать сорта под ваш профиль.</p>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Открыть весь каталог
          <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary" strokeWidth={1.75} />
        <h2 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
          Вам точно понравится
        </h2>
      </div>
      <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
        Мы подобрали {products.length} {products.length === 1 ? "сорт" : "сорта"} под ваши предпочтения.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
        {products.map((product) => {
          const score = matchMap.get(product.id) ?? 0
          const percent = Math.min(100, Math.max(40, Math.round(score)))
          const level = percent >= 85 ? "Идеально вам" : percent >= 70 ? "Отличный выбор" : "Подойдёт"
          return (
            <div key={product.id} className="relative rounded-xl ring-2 ring-primary/20 p-3 bg-primary/5">
              <div className="flex items-center justify-between mb-2.5 px-1">
                <span className="text-[11px] sm:text-xs font-semibold text-primary uppercase tracking-wide">
                  {level}
                </span>
                <span className="text-[11px] sm:text-xs font-bold text-primary">
                  {percent}%
                </span>
              </div>
              <ProductCard product={product} />
            </div>
          )
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onRestart}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          <RotateCcw className="w-4 h-4" strokeWidth={1.75} />
          Пройти ещё раз
        </button>
        <Link
          href="/catalog"
          className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Смотреть все сорта
          <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  )
}
