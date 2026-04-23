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

interface NextGift {
  name: string
  imageUrl: string | null
  minCartTotal: number
  addMore: number
}

/**
 * Компонент выбора подарка на checkout. Подтягивает доступные подарки через
 * /api/gifts/available?cartTotal=X, показывает их как радио-карточки.
 * Если cartTotal изменился (убрали товар / применили промокод) и выбранный
 * подарок перестал быть доступен — сбрасывает выбор.
 *
 * Если доступных gifts пока 0, но в каталоге есть ещё-недостигнутые —
 * показываем мотивационную подсказку «Добавьте ещё X₽ — получите {name}»
 * через /api/gifts/next-threshold.
 */
export function GiftPicker({ cartTotal, value, onChange }: GiftPickerProps) {
  const [gifts, setGifts] = useState<GiftOption[] | null>(null)
  const [nextGift, setNextGift] = useState<NextGift | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    // Debounce 300ms чтобы не дёргать backend при быстрых изменениях корзины.
    const timer = setTimeout(async () => {
      try {
        const [availRes, nextRes] = await Promise.all([
          fetch(`/api/gifts/available?cartTotal=${encodeURIComponent(cartTotal)}`),
          fetch(`/api/gifts/next-threshold?cartTotal=${encodeURIComponent(cartTotal)}`),
        ])
        if (cancelled) return
        const availData = availRes.ok ? await availRes.json() : { gifts: [] }
        const nextData = nextRes.ok ? await nextRes.json() : { next: null }

        const list: GiftOption[] = availData.gifts ?? []
        setGifts(list)
        setNextGift(nextData.next ?? null)
        // Если выбранный подарок больше не в списке — сбрасываем
        if (value && !list.find((g) => g.id === value)) {
          onChange(null)
        }
      } catch {
        if (!cancelled) {
          setGifts([])
          setNextGift(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartTotal])

  // GF2: если доступных gifts нет, но есть ближайший следующий порог —
  // показываем мотивационную карточку
  if (gifts !== null && gifts.length === 0 && nextGift) {
    return (
      <div className="bg-gradient-to-br from-amber-50/60 to-orange-50/60 border border-dashed border-amber-300 rounded-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          {nextGift.imageUrl ? (
            <Image
              src={nextGift.imageUrl}
              alt={nextGift.name}
              width={56}
              height={56}
              className="w-14 h-14 rounded-lg object-cover opacity-70"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
              <GiftIcon className="w-6 h-6 text-amber-600" />
            </div>
          )}
          <div className="flex-1">
            <p className="font-semibold text-amber-900">
              Добавьте ещё {nextGift.addMore}₽ — получите подарок
            </p>
            <p className="text-xs text-amber-700 mt-1">
              «{nextGift.name}» доступен от {nextGift.minCartTotal}₽
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!gifts || gifts.length === 0) return null

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-2">
        <GiftIcon className="w-5 h-5 text-amber-600" />
        <h3 className="font-semibold text-amber-900">
          Бесплатный подарок к заказу
        </h3>
        <span className="ml-auto text-[11px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
          по желанию
        </span>
      </div>
      <p className="text-xs text-amber-800 mb-4">
        Положим в коробку бесплатно. Выберите один из доступных или откажитесь — ничего не изменится.
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
