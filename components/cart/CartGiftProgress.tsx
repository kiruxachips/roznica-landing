"use client"

import { useEffect, useState } from "react"
import { Package, Gift } from "lucide-react"

interface Thresholds {
  freeDelivery: number
  gift: number
  giftDescription: string
}

interface CartGiftProgressProps {
  total: number
}

let cachedThresholds: Thresholds | null = null

export function CartGiftProgress({ total }: CartGiftProgressProps) {
  const [thresholds, setThresholds] = useState<Thresholds | null>(cachedThresholds)

  useEffect(() => {
    if (cachedThresholds) return
    fetch("/api/delivery/settings")
      .then((r) => r.json())
      .then((d) => {
        const t: Thresholds = {
          freeDelivery: d.freeDeliveryThreshold || 3000,
          gift: d.giftThreshold || 5000,
          giftDescription: d.giftDescription || "Подарок от нас",
        }
        cachedThresholds = t
        setThresholds(t)
      })
      .catch(() => {
        const fallback = { freeDelivery: 3000, gift: 5000, giftDescription: "Подарок от нас" }
        cachedThresholds = fallback
        setThresholds(fallback)
      })
  }, [])

  if (!thresholds || total === 0) return null

  const { freeDelivery, gift, giftDescription } = thresholds
  const maxTarget = gift > 0 ? gift : freeDelivery

  // Determine active milestone
  const hasFreeDelivery = freeDelivery > 0 && total >= freeDelivery
  const hasGift = gift > 0 && total >= gift

  // Progress calculation: use the next unmet milestone as target
  const nextTarget = !hasFreeDelivery && freeDelivery > 0 ? freeDelivery : !hasGift && gift > 0 ? gift : maxTarget
  const progress = maxTarget > 0 ? Math.min(100, (total / maxTarget) * 100) : 100
  const remaining = nextTarget - total

  if (hasGift) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3 text-sm">
        <div className="flex items-center gap-2 text-amber-800 font-medium">
          <Gift className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Бесплатная доставка Почтой России + {giftDescription}!</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Milestone hints — stacked to avoid overflow on narrow drawers */}
      <div className="space-y-0.5 text-xs">
        {!hasFreeDelivery && freeDelivery > 0 ? (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Package className="w-3 h-3 shrink-0" />
            <span>До бесплатной доставки — <span className="font-semibold text-foreground">{remaining}₽</span></span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-green-600 font-medium">
            <Package className="w-3 h-3 shrink-0" />
            <span>Бесплатная доставка Почтой России</span>
          </div>
        )}

        {gift > 0 && !hasGift && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <Gift className="w-3 h-3 shrink-0" />
            <span>До подарка — <span className="font-semibold text-foreground">{gift - total}₽</span></span>
          </div>
        )}
        {gift > 0 && hasGift && (
          <div className="flex items-center gap-1 text-amber-600 font-medium">
            <Gift className="w-3 h-3 shrink-0" />
            <span>Подарок включён</span>
          </div>
        )}
      </div>
    </div>
  )
}
