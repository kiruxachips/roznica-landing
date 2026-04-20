"use client"

import Link from "next/link"
import { RotateCcw, ArrowRight, Sparkles, Trophy, Award, ThumbsUp } from "lucide-react"
import { ProductCard } from "@/components/catalog/ProductCard"
import type { ProductCard as ProductCardType } from "@/lib/types"

interface Match {
  productId: string
  percent: number
  reasons: string[]
}

interface QuizResultProps {
  products: ProductCardType[]
  matches: Match[]
  onRestart: () => void
}

const TIERS = [
  {
    label: "Идеально вам",
    icon: Trophy,
    chip: "bg-primary text-white",
    ring: "ring-2 ring-primary",
  },
  {
    label: "Отличный выбор",
    icon: Award,
    chip: "bg-primary/10 text-primary",
    ring: "ring-1 ring-primary/30",
  },
  {
    label: "Тоже подойдёт",
    icon: ThumbsUp,
    chip: "bg-secondary text-muted-foreground",
    ring: "ring-1 ring-border",
  },
] as const

export function QuizResult({ products, matches, onRestart }: QuizResultProps) {
  const matchMap = new Map(matches.map((m) => [m.productId, m]))

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
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-primary" strokeWidth={1.75} />
        <h2 className="font-sans text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
          Вам точно понравится
        </h2>
      </div>
      <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
        {products.length === 1
          ? "Нашли 1 сорт под ваш вкус."
          : `Подобрали ${products.length} ${products.length < 5 ? "сорта" : "сортов"} — отсортированы от лучшего совпадения.`}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mb-8">
        {products.map((product, idx) => {
          const m = matchMap.get(product.id)
          const tier = TIERS[Math.min(idx, TIERS.length - 1)]
          const Icon = tier.icon
          const reasons = m?.reasons ?? []
          return (
            <div key={product.id} className="relative">
              {/* Tier pill above the card */}
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold mb-2 ${tier.chip}`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={2} />
                {tier.label}
              </div>
              {reasons.length > 0 && (
                <p className="mb-2 text-[11px] sm:text-xs text-muted-foreground leading-snug">
                  Почему: {reasons.join(" · ")}
                </p>
              )}
              <div className={`rounded-xl ${tier.ring} transition-shadow`}>
                <ProductCard product={product} />
              </div>
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
