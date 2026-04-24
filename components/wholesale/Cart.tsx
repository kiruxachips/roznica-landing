"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Trash2 } from "lucide-react"
import { useWholesaleCart } from "@/lib/store/wholesale-cart"
import { refreshWholesaleCart, getCartTierPreview } from "@/lib/actions/wholesale-orders"

function parseWeightGrams(w: string): number {
  const lower = w.toLowerCase().trim()
  const m = lower.match(/^([\d.,]+)\s*(кг|г|kg|g)?$/)
  if (!m) return 0
  const n = parseFloat(m[1].replace(",", "."))
  if (isNaN(n)) return 0
  const unit = m[2] || "г"
  return unit === "кг" || unit === "kg" ? Math.round(n * 1000) : Math.round(n)
}

interface TierState {
  tiers: { minWeightGrams: number; discountPct: number }[]
  applied: { minWeightGrams: number; discountPct: number } | null
  next: { minWeightGrams: number; discountPct: number } | null
  discountPct: number
}

export function WholesaleCart({ paymentTerms }: { paymentTerms: string }) {
  const items = useWholesaleCart((s) => s.items)
  const updateQuantity = useWholesaleCart((s) => s.updateQuantity)
  const removeItem = useWholesaleCart((s) => s.removeItem)
  const updateItemPrice = useWholesaleCart((s) => s.updateItemPrice)
  const [refreshing, setRefreshing] = useState(true)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [tier, setTier] = useState<TierState | null>(null)

  const totalWeightGrams = useMemo(
    () => items.reduce((s, i) => s + parseWeightGrams(i.weight) * i.quantity, 0),
    [items]
  )

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      if (items.length === 0) {
        setRefreshing(false)
        return
      }
      setRefreshing(true)
      try {
        const prices = await refreshWholesaleCart(items.map((i) => i.variantId))
        if (cancelled) return
        let priceChanged = false
        let removed = 0
        for (const it of items) {
          const p = prices[it.variantId]
          if (!p) {
            removeItem(it.variantId)
            removed++
            continue
          }
          if (p.price !== it.unitPrice) priceChanged = true
          updateItemPrice(
            it.variantId,
            p.price,
            p.price < it.unitPrice ? null : it.unitOldPrice,
            p.stock,
            p.minQuantity
          )
        }
        if (removed > 0) {
          setRefreshMsg(`Удалено позиций, которые больше недоступны: ${removed}`)
        } else if (priceChanged) {
          setRefreshMsg("Цены обновлены")
        }
      } catch (e) {
        setRefreshMsg(e instanceof Error ? e.message : "Не удалось обновить цены")
      } finally {
        setRefreshing(false)
      }
    }
    refresh()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reload tier при каждом изменении веса
  useEffect(() => {
    if (items.length === 0) {
      setTier(null)
      return
    }
    getCartTierPreview(totalWeightGrams)
      .then((data) => setTier(data as TierState))
      .catch(() => {})
  }, [totalWeightGrams, items.length])

  const totalItems = items.reduce((s, i) => s + i.quantity, 0)
  const gross = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const tierDiscount = Math.round((gross * (tier?.discountPct ?? 0)) / 100)
  const total = gross - tierDiscount

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <p className="text-muted-foreground mb-4">Корзина пуста</p>
        <Link
          href="/wholesale/catalog"
          className="inline-flex rounded-xl bg-primary text-primary-foreground font-medium px-6 py-2.5 hover:bg-primary/90 transition-colors"
        >
          В каталог
        </Link>
      </div>
    )
  }

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-5">
      <div className="space-y-3">
        {refreshMsg && !refreshing && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
            {refreshMsg}
          </div>
        )}
        {items.map((item) => (
          <div key={item.variantId} className="bg-white rounded-2xl shadow-sm p-4 flex gap-4">
            {item.image && (
              <div className="w-20 h-20 relative shrink-0 bg-secondary/30 rounded-xl overflow-hidden">
                <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <Link href={`/wholesale/catalog/${item.slug}`} className="font-medium hover:underline">
                {item.name}
              </Link>
              <div className="text-xs text-muted-foreground mt-0.5">
                {item.weight} · {item.unitPrice.toLocaleString("ru")}₽ за шт
                {item.minQuantity > 1 && ` · мин. ${item.minQuantity}`}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() =>
                    updateQuantity(
                      item.variantId,
                      Math.max(item.minQuantity, item.quantity - item.minQuantity)
                    )
                  }
                  className="w-8 h-8 rounded-lg border border-border hover:bg-muted"
                >
                  −
                </button>
                <input
                  type="number"
                  min={item.minQuantity}
                  step={item.minQuantity}
                  max={item.stock}
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.variantId, Number(e.target.value) || item.minQuantity)}
                  className="w-20 text-center rounded-lg border border-border py-1.5"
                />
                <button
                  onClick={() =>
                    updateQuantity(
                      item.variantId,
                      Math.min(item.stock, item.quantity + item.minQuantity)
                    )
                  }
                  className="w-8 h-8 rounded-lg border border-border hover:bg-muted"
                >
                  +
                </button>
                <button
                  onClick={() => removeItem(item.variantId)}
                  className="ml-2 text-muted-foreground hover:text-red-600"
                  aria-label="Удалить"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-semibold">
                {(item.quantity * item.unitPrice).toLocaleString("ru")}₽
              </div>
            </div>
          </div>
        ))}
      </div>

      <aside className="lg:sticky lg:top-24 h-fit bg-white rounded-2xl shadow-sm p-5 space-y-3">
        <h2 className="font-semibold">Итого</h2>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Позиций</span>
          <span>{totalItems} шт</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Вес корзины</span>
          <span>{(totalWeightGrams / 1000).toFixed(2)} кг</span>
        </div>

        {tier && tier.tiers.length > 0 && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 space-y-2">
            {tier.applied ? (
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  Скидка {tier.applied.discountPct}% применена
                </span>
                <span className="text-primary font-semibold">
                  −{tierDiscount.toLocaleString("ru")}₽
                </span>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Скидка по весу пока не активна
              </div>
            )}
            {tier.next && (
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  До −{tier.next.discountPct}% осталось{" "}
                  <strong className="text-foreground">
                    {((tier.next.minWeightGrams - totalWeightGrams) / 1000).toFixed(2)} кг
                  </strong>
                </div>
                <div className="h-1.5 rounded-full bg-primary/10 overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, (totalWeightGrams / tier.next.minWeightGrams) * 100).toFixed(1)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Условия оплаты</span>
          <span>
            {paymentTerms === "prepay"
              ? "Предоплата"
              : `Отсрочка ${paymentTerms.replace("net", "")} дн.`}
          </span>
        </div>
        {tierDiscount > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Без скидки</span>
            <span className="line-through">{gross.toLocaleString("ru")}₽</span>
          </div>
        )}
        <div className="flex justify-between font-semibold pt-2 border-t">
          <span>К оплате</span>
          <span>{total.toLocaleString("ru")}₽</span>
        </div>
        <Link
          href="/wholesale/checkout"
          className="block text-center rounded-xl bg-primary text-primary-foreground font-medium py-2.5 hover:bg-primary/90 transition-colors"
        >
          Оформить заказ
        </Link>
        <p className="text-xs text-muted-foreground">
          Без учёта доставки — рассчитаем на следующем шаге.
        </p>
      </aside>
    </div>
  )
}
