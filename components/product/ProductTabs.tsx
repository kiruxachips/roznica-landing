"use client"

import { useState } from "react"
import { Star, MessageSquare, List, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProductMeta } from "@/components/product/ProductMeta"
import { BrewingMethods } from "@/components/product/BrewingMethods"
import { ReviewsList } from "@/components/product/ReviewsList"

interface Review {
  id: string
  name: string
  text: string
  rating: number
  date: string | null
  createdAt: Date
}

interface ProductTabsProps {
  fullDescription: string | null
  origin: string | null
  region: string | null
  altitude: string | null
  roastLevel: string | null
  processingMethod: string | null
  farm: string | null
  brewingMethods: string[]
  reviews: Review[]
}

type Tab = "description" | "meta" | "reviews"

export function ProductTabs({
  fullDescription,
  origin,
  region,
  altitude,
  roastLevel,
  processingMethod,
  farm,
  brewingMethods,
  reviews,
}: ProductTabsProps) {
  const [active, setActive] = useState<Tab>("description")

  const avgRating =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null

  const tabs: { id: Tab; label: string; icon: typeof FileText; count?: number }[] = [
    { id: "description", label: "Описание", icon: FileText },
    { id: "meta", label: "Характеристики", icon: List },
    { id: "reviews", label: "Отзывы", icon: MessageSquare, count: reviews.length },
  ]

  return (
    <div className="mt-12 sm:mt-16" id="product-tabs">
      {/* Tab bar */}
      <div className="flex gap-1 bg-secondary/50 rounded-2xl p-1.5 max-w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-sm font-medium transition-all",
              active === tab.id
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4 hidden sm:block" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={cn(
                "text-xs px-1.5 py-0.5 rounded-full",
                active === tab.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-8">
        {active === "description" && (
          fullDescription ? (
            <div className="max-w-3xl">
              {fullDescription.split("\n\n").map((paragraph, i) => {
                const text = paragraph.trim()
                if (!text) return null
                // First paragraph — lead style
                if (i === 0) {
                  return (
                    <p key={i} className="text-foreground text-lg leading-relaxed mb-6 font-medium">
                      {text}
                    </p>
                  )
                }
                return (
                  <p key={i} className="text-muted-foreground leading-[1.8] mb-5 last:mb-0 text-[15px] border-l-2 border-primary/15 pl-4">
                    {text}
                  </p>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">Подробное описание отсутствует.</p>
          )
        )}

        {active === "meta" && (
          <div className="space-y-8 max-w-2xl">
            <ProductMeta
              origin={origin}
              region={region}
              altitude={altitude}
              roastLevel={roastLevel}
              processingMethod={processingMethod}
              farm={farm}
            />
            {brewingMethods.length > 0 && <BrewingMethods methods={brewingMethods} />}
          </div>
        )}

        {active === "reviews" && (
          <div>
            {reviews.length > 0 ? (
              <>
                {/* Rating summary */}
                {avgRating && (
                  <div className="flex items-center gap-4 mb-8 p-5 bg-secondary/30 rounded-2xl max-w-md">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-foreground">{avgRating}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">из 5</p>
                    </div>
                    <div>
                      <div className="flex mb-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={i < Math.round(avgRating) ? "w-5 h-5 fill-amber-400 text-amber-400" : "w-5 h-5 text-muted-foreground/20"}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {reviews.length} {reviews.length === 1 ? "отзыв" : reviews.length < 5 ? "отзыва" : "отзывов"}
                      </p>
                    </div>
                  </div>
                )}
                <ReviewsList reviews={reviews} />
              </>
            ) : (
              <p className="text-muted-foreground">Отзывов пока нет. Будьте первым!</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
