"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Minus, Plus, Trash2, Tag, X, Loader2 } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"
import { CartGiftProgress } from "./CartGiftProgress"
import { CartUpsell } from "./CartUpsell"

export function CartPage() {
  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const totalPrice = useCartStore((s) => s.totalPrice)
  const promoCode = useCartStore((s) => s.promoCode)
  const promoDiscount = useCartStore((s) => s.promoDiscount)
  const promoType = useCartStore((s) => s.promoType)
  const promoValue = useCartStore((s) => s.promoValue)
  const setPromo = useCartStore((s) => s.setPromo)
  const clearPromo = useCartStore((s) => s.clearPromo)

  const [mounted, setMounted] = useState(false)
  const [promoInput, setPromoInput] = useState("")
  const [promoLoading, setPromoLoading] = useState(false)
  const [promoError, setPromoError] = useState("")

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  const subtotal = totalPrice()
  const afterDiscount = subtotal - promoDiscount

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-xl text-muted-foreground mb-4">Корзина пуста</p>
        <Link href="/catalog" className="text-primary hover:underline">
          Перейти в каталог
        </Link>
      </div>
    )
  }

  async function handleApplyPromo() {
    const code = promoInput.trim()
    if (!code) return

    setPromoLoading(true)
    setPromoError("")

    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal }),
      })

      const data = await res.json()

      if (!res.ok) {
        setPromoError(data.error || "Ошибка при проверке промокода")
        return
      }

      setPromo(data.code, data.type, data.value, data.discount)
      setPromoInput("")
    } catch {
      setPromoError("Ошибка сети")
    } finally {
      setPromoLoading(false)
    }
  }

  function handleClearPromo() {
    clearPromo()
    setPromoInput("")
    setPromoError("")
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-8">
      {/* Items list */}
      <div className="lg:col-span-2 space-y-3 sm:space-y-4">
        {items.map((item) => (
          <div key={item.variantId} className="bg-white rounded-2xl p-3 sm:p-5 shadow-sm flex gap-3 sm:gap-4">
            {item.image && (
              <Link href={`/catalog/${item.slug}`}>
                <Image
                  src={item.image}
                  alt={item.name}
                  width={96}
                  height={96}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover flex-shrink-0"
                />
              </Link>
            )}
            <div className="flex-1 min-w-0">
              <Link href={`/catalog/${item.slug}`}>
                <h3 className="font-medium text-sm sm:text-base hover:text-primary transition-colors truncate">
                  {item.name}
                </h3>
              </Link>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{item.weight}</p>
              <p className="text-sm sm:text-base font-semibold text-primary mt-1">{item.price}₽</p>

              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted text-sm"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-9 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => item.quantity < 99 && updateQuantity(item.variantId, item.quantity + 1)}
                    disabled={item.quantity >= 99}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted text-sm disabled:opacity-30"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-sm font-semibold ml-auto">{item.price * item.quantity}₽</span>
                <button
                  onClick={() => removeItem(item.variantId)}
                  className="p-2 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        <CartUpsell cartProductIds={items.map((i) => i.productId)} onClose={() => {}} />
      </div>

      {/* Summary */}
      <div className="lg:col-span-1">
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm lg:sticky lg:top-24 space-y-5">
          {/* Promo code */}
          <div>
            <h3 className="text-sm font-medium mb-2">Промокод</h3>
            {promoCode ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 text-sm font-medium px-3 py-1.5 rounded-lg">
                  <Tag className="w-3.5 h-3.5" />
                  {promoCode}
                  {promoType === "percent" ? ` (-${promoValue}%)` : ` (-${promoValue}₽)`}
                </span>
                <button
                  onClick={handleClearPromo}
                  className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={promoInput}
                  onChange={(e) => {
                    setPromoInput(e.target.value.toUpperCase())
                    setPromoError("")
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                  placeholder="Введите код"
                  className="flex-1 h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                />
                <button
                  onClick={handleApplyPromo}
                  disabled={promoLoading || !promoInput.trim()}
                  className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Применить"}
                </button>
              </div>
            )}
            {promoError && <p className="text-xs text-red-600 mt-1.5">{promoError}</p>}
          </div>

          {/* Gift / free delivery progress */}
          <CartGiftProgress total={afterDiscount} />

          {/* Totals */}
          <div className="border-t border-border pt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Подытог</span>
              <span>{subtotal}₽</span>
            </div>
            {promoDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Скидка ({promoCode})</span>
                <span>-{promoDiscount}₽</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Доставка</span>
              <span className="text-muted-foreground text-xs">при оформлении</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
              <span>Итого</span>
              <span className="text-primary">{afterDiscount}₽</span>
            </div>
          </div>

          <Link
            href="/checkout"
            className="block w-full h-12 bg-primary text-primary-foreground rounded-xl font-medium text-center leading-[3rem] hover:bg-primary/90 transition-colors"
          >
            Оформить заказ
          </Link>
        </div>
      </div>
    </div>
  )
}
