"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Check, Truck } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { FREE_DELIVERY_INFO } from "@/lib/constants"
import type { RecommendedProduct } from "@/lib/types"

interface ReplacementPickerProps {
  /** Заменяемая позиция: показываем «Закончился: …» и грузим альтернативы. */
  variantId: string
  productName: string
  /** Количество, которое было в корзине — переносится на замену 1:1. */
  quantity: number
  /** Сумма корзины ПОСЛЕ удаления этой позиции (без доставки). Нужна
   *  чтобы понять, добивает ли замена до бесплатной доставки и подписать
   *  карточку «+ бесплатная доставка». */
  cartTotalWithoutItem: number
  /** Порог бесплатной доставки. Если 0 — бейдж не показываем. */
  freeDeliveryThreshold: number
  /** Замена выбрана — родитель удаляет старую позицию и добавляет новую. */
  onReplace: (replacement: RecommendedProduct) => void
  /** Юзер отказался от замены — просто удаляем старую позицию. */
  onSkip: () => void
}

export function ReplacementPicker({
  variantId,
  productName,
  quantity,
  cartTotalWithoutItem,
  freeDeliveryThreshold,
  onReplace,
  onSkip,
}: ReplacementPickerProps) {
  const [replacements, setReplacements] = useState<RecommendedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const cartItems = useCartStore((s) => s.items)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch("/api/cart/replacements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, limit: 3 }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { replacements: [] }))
      .then((d) => setReplacements(d.replacements ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
    return () => ctrl.abort()
  }, [variantId])

  // Исключаем варианты, которые уже лежат в корзине — их «замена»
  // выродится в «увеличить количество существующего», что путает.
  const inCartVariantIds = new Set(cartItems.map((i) => i.variantId))
  const visible = replacements.filter(
    (r) => !inCartVariantIds.has(r.recommendedVariant.id)
  )

  return (
    <div className="bg-amber-50 rounded-xl p-3.5 space-y-3">
      <div>
        <p className="text-sm font-medium">
          Упс, «{productName}» закончился пока вы собирали корзину
        </p>
        {!loading && visible.length > 0 && (
          <p className="text-xs text-amber-800 mt-0.5">
            Подобрали похожие по вкусовому профилю — заменим в один клик
          </p>
        )}
      </div>

      {loading && (
        <div className="space-y-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-14 rounded-lg bg-white/60 animate-pulse"
            />
          ))}
        </div>
      )}

      {!loading && visible.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Подходящей замены сейчас нет в наличии.
        </p>
      )}

      {!loading && visible.length > 0 && (
        <div className="space-y-1.5">
          {visible.map((rec) => {
            const v = rec.recommendedVariant
            // Полная стоимость позиции с учётом quantity, чтобы корректно
            // оценить попадание в порог бесплатной доставки.
            const lineTotal = v.price * quantity
            const totalAfterReplace = cartTotalWithoutItem + lineTotal
            const unlocksFreeDelivery =
              freeDeliveryThreshold > 0 &&
              cartTotalWithoutItem < freeDeliveryThreshold &&
              totalAfterReplace >= freeDeliveryThreshold
            const delta = rec.priceDelta ?? 0

            return (
              <div
                key={rec.id}
                className="flex items-center gap-3 bg-white rounded-lg p-2.5"
              >
                <div className="shrink-0">
                  {rec.primaryImage ? (
                    <Image
                      src={rec.primaryImage}
                      alt={rec.primaryImageAlt ?? rec.name}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground text-xs">
                      —
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate leading-snug">
                    {rec.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {v.weight} · {v.price}₽
                    {delta !== 0 && (
                      <span
                        className={
                          delta > 0
                            ? "text-amber-700 ml-1.5"
                            : "text-green-700 ml-1.5"
                        }
                      >
                        {delta > 0 ? `+${delta}₽` : `−${Math.abs(delta)}₽`} к старой цене
                      </span>
                    )}
                  </p>
                  {unlocksFreeDelivery && (
                    <p className="text-[11px] text-green-700 font-medium mt-0.5 flex items-center gap-1">
                      <Truck className="w-3 h-3" />
                      Откроется бесплатная доставка
                      <InfoTooltip text={FREE_DELIVERY_INFO} align="start" iconSize="xs" />
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onReplace(rec)}
                  className="shrink-0 h-9 px-3 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Заменить
                </button>
              </div>
            )
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onSkip}
        className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
      >
        Просто убрать из корзины
      </button>
    </div>
  )
}
