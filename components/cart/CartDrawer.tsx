"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { X, Minus, Plus, Trash2 } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"
import { cn } from "@/lib/utils"
import { CartGiftProgress } from "./CartGiftProgress"
import { CartUpsell } from "./CartUpsell"

export function CartDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const items = useCartStore((s) => s.items)
  const removeItem = useCartStore((s) => s.removeItem)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const totalPrice = useCartStore((s) => s.totalPrice)
  const promoCode = useCartStore((s) => s.promoCode)
  const promoDiscount = useCartStore((s) => s.promoDiscount)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  const total = totalPrice()
  const afterDiscount = total - promoDiscount
  const cartProductIds = items.map((i) => i.productId)

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-[92vw] sm:max-w-md bg-white z-50 shadow-xl transition-transform duration-300 flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Корзина</h2>
          <button
            onClick={onClose}
            aria-label="Закрыть корзину"
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">Корзина пуста</p>
              <Link href="/catalog" onClick={onClose} className="text-primary hover:underline text-sm">
                Перейти в каталог
              </Link>
            </div>
          ) : (
            <>
            {items.map((item) => (
              <div key={item.variantId} className="flex gap-3 bg-secondary/30 rounded-xl p-3">
                {item.image && (
                  <Link href={`/catalog/${item.slug}`} onClick={onClose}>
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                  </Link>
                )}
                <div className="flex-1 min-w-0">
                  <Link href={`/catalog/${item.slug}`} onClick={onClose}>
                    <p className="font-medium text-sm truncate hover:text-primary transition-colors">{item.name}</p>
                  </Link>
                  <p className="text-xs text-muted-foreground">{item.weight}</p>
                  <p className="text-sm font-semibold text-primary mt-1">{item.price}₽</p>
                </div>

                <div className="flex flex-col items-end justify-between">
                  <button
                    onClick={() => removeItem(item.variantId)}
                    aria-label={`Удалить ${item.name} из корзины`}
                    className="p-2 text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                      aria-label="Уменьшить количество"
                      className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-muted text-xs"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                    <button
                      onClick={() => item.quantity < 99 && updateQuantity(item.variantId, item.quantity + 1)}
                      disabled={item.quantity >= 99}
                      aria-label="Увеличить количество"
                      className="w-8 h-8 flex items-center justify-center rounded-md border border-border hover:bg-muted text-xs disabled:opacity-30"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <CartUpsell cartProductIds={cartProductIds} onClose={onClose} />
            </>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-border space-y-3">
            {/* Gift / free delivery progress */}
            <CartGiftProgress total={total} />

            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Подытог</span>
                <span>{total}₽</span>
              </div>
              {promoDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Скидка ({promoCode})</span>
                  <span>-{promoDiscount}₽</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Доставка</span>
                <span className="text-xs text-muted-foreground">при оформлении</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                <span>Итого</span>
                <span className="text-primary">{afterDiscount}₽</span>
              </div>
            </div>

            <Link
              href="/cart"
              onClick={onClose}
              className="block w-full h-10 border border-border rounded-xl font-medium text-sm text-center leading-[2.5rem] hover:bg-muted transition-colors"
            >
              Перейти в корзину
            </Link>
            <Link
              href="/checkout"
              onClick={onClose}
              className="block w-full h-12 bg-primary text-primary-foreground rounded-xl font-medium text-center leading-[3rem] hover:bg-primary/90 transition-colors"
            >
              Оформить заказ
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
