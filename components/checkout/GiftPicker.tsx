"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Gift as GiftIcon } from "lucide-react"

interface GiftOption {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  imageAlt: string | null
  minCartTotal: number
  stockRemaining: number | null
}

interface GiftPickerProps {
  /** Сумма корзины после скидок и бонусов */
  cartTotal: number
  /** Выбранный giftId или null */
  value: string | null
  onChange: (giftId: string | null) => void
}

/**
 * Компонент выбора подарка на checkout. Подтягивает доступные подарки через
 * /api/gifts/available?cartTotal=X, показывает их как радио-карточки.
 * Если cartTotal изменился (убрали товар / применили промокод) и выбранный
 * подарок перестал быть доступен — сбрасывает выбор.
 */
export function GiftPicker({ cartTotal, value, onChange }: GiftPickerProps) {
  const [gifts, setGifts] = useState<GiftOption[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    // Debounce 300ms чтобы не дёргать backend при быстрых изменениях корзины.
    const timer = setTimeout(() => {
      fetch(`/api/gifts/available?cartTotal=${encodeURIComponent(cartTotal)}`)
        .then((r) => (r.ok ? r.json() : { gifts: [] }))
        .then((data) => {
          if (cancelled) return
          const list: GiftOption[] = data.gifts ?? []
          setGifts(list)
          // Если выбранный подарок больше не в списке — сбрасываем
          if (value && !list.find((g) => g.id === value)) {
            onChange(null)
          }
        })
        .catch(() => {
          if (!cancelled) setGifts([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartTotal])

  if (!gifts || gifts.length === 0) return null

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <GiftIcon className="w-5 h-5 text-amber-600" />
        <h3 className="font-semibold text-amber-900">
          Выберите подарок к заказу
        </h3>
      </div>
      <p className="text-xs text-amber-800 mb-4">
        Подарок кладётся в коробку бесплатно. Можно выбрать один из доступных.
      </p>

      <div className="space-y-2" role="radiogroup" aria-label="Выбор подарка">
        {/* "Без подарка" — явный опт-аут, иначе юзер может не понять что выбор добровольный */}
        <label
          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors bg-white ${
            value === null ? "border-amber-500" : "border-amber-100 hover:border-amber-300"
          }`}
        >
          <input
            type="radio"
            name="gift"
            checked={value === null}
            onChange={() => onChange(null)}
            className="accent-amber-600"
          />
          <div className="flex-1">
            <p className="text-sm font-medium">Без подарка</p>
            <p className="text-xs text-muted-foreground">Оформить заказ без бонуса</p>
          </div>
        </label>

        {gifts.map((g) => {
          const isSelected = value === g.id
          return (
            <label
              key={g.id}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors bg-white ${
                isSelected ? "border-amber-500" : "border-amber-100 hover:border-amber-300"
              }`}
            >
              <input
                type="radio"
                name="gift"
                checked={isSelected}
                onChange={() => onChange(g.id)}
                className="accent-amber-600"
              />
              {g.imageUrl ? (
                <Image
                  src={g.imageUrl}
                  alt={g.imageAlt || g.name}
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-lg object-cover"
                />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <GiftIcon className="w-6 h-6 text-amber-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{g.name}</p>
                {g.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{g.description}</p>
                )}
                {g.stockRemaining !== null && g.stockRemaining <= 5 && g.stockRemaining > 0 && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Осталось {g.stockRemaining} шт.
                  </p>
                )}
              </div>
            </label>
          )
        })}
      </div>

      {loading && (
        <p className="text-[11px] text-muted-foreground mt-2">Обновляем список…</p>
      )}
    </div>
  )
}
