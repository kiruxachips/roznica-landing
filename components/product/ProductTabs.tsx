"use client"

import { useState } from "react"
import { Star } from "lucide-react"
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

  const tabs: { id: Tab; label: string }[] = [
    { id: "description", label: "Описание" },
    { id: "meta", label: "Характеристики" },
    { id: "reviews", label: `Отзывы${reviews.length > 0 ? ` (${reviews.length})` : ""}` },
  ]

  return (
    <div className="mt-12 sm:mt-16">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "px-5 py-3 text-sm font-medium transition-colors relative",
              active === tab.id
                ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pt-8">
        {active === "description" && (
          fullDescription ? (
            <div className="max-w-3xl text-muted-foreground leading-relaxed whitespace-pre-line">
              {fullDescription}
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
                {avgRating && (
                  <div className="flex items-center gap-2 mb-6">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={i < Math.round(avgRating) ? "w-5 h-5 fill-amber-400 text-amber-400" : "w-5 h-5 text-muted-foreground/30"}
                        />
                      ))}
                    </div>
                    <span className="text-lg font-bold">{avgRating}</span>
                    <span className="text-sm text-muted-foreground">из 5 ({reviews.length} отзывов)</span>
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
