"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"
import { useCartUIStore } from "@/lib/store/cart-ui"
import type { RecommendedProduct } from "@/lib/types"

interface CartUpsellProps {
  cartProductIds: string[]
  onClose: () => void
  variant?: "drawer" | "page"
}

const REASON_LABEL: Record<RecommendedProduct["reason"], string> = {
  milestone_free_delivery: "До бесплатной доставки",
  milestone_gift: "До подарка",
  affinity: "Вам может понравиться",
  popular: "Популярное",
  "cross-sell": "Попробуйте также",
}

export function CartUpsell({ cartProductIds, onClose, variant = "drawer" }: CartUpsellProps) {
  const [products, setProducts] = useState<RecommendedProduct[]>([])
  const addItem = useCartStore((s) => s.addItem)
  const totalPrice = useCartStore((s) => s.totalPrice)
  const openDrawer = useCartUIStore((s) => s.openDrawer)
  const [addedId, setAddedId] = useState<string | null>(null)
  const prevKeyRef = useRef<string>("")

  useEffect(() => {
    const key = cartProductIds.slice().sort().join(",")
    if (key === prevKeyRef.current) return

    const total = totalPrice()
    // Debounce: при быстрых кликах "+"/"-" ждём 300мс покоя, чтобы не
    // сжечь бэкенд параллельными одинаковыми запросами.
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      prevKeyRef.current = key
      fetch("/api/cart/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartProductIds, cartTotal: total }),
        signal: ctrl.signal,
      })
        .then((r) => r.json())
        .then((data) => setProducts(data.recommendations ?? []))
        .catch(() => {})
    }, 300)

    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [cartProductIds, totalPrice])

  if (products.length === 0) return null

  function handleAdd(rec: RecommendedProduct) {
    const v = rec.recommendedVariant
    if (!v || v.stock <= 0) return
    addItem({
      productId: rec.id,
      variantId: v.id,
      name: rec.name,
      weight: v.weight,
      price: v.price,
      image: rec.primaryImage,
      quantity: 1,
      slug: rec.slug,
    })
    setAddedId(v.id)
    if (variant === "drawer") openDrawer()
    setTimeout(() => setAddedId(null), 1500)
  }

  // Dominant reason label for the section header
  const topReason = products[0]?.reason ?? "popular"
  const sectionLabel = REASON_LABEL[topReason]

  return (
    <div className="mt-1 rounded-2xl border border-border/60 bg-secondary/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">
        {sectionLabel}
      </p>
      <div className="space-y-1.5">
        {products
          .filter((rec) => !cartProductIds.includes(rec.id))
          .slice(0, variant === "page" ? 4 : 3)
          .map((rec) => {
            const v = rec.recommendedVariant
            const justAdded = addedId === v.id
            return (
              <div key={rec.id} className="flex items-center gap-3 bg-white rounded-xl p-2.5">
                <Link href={`/catalog/${rec.slug}`} onClick={onClose} className="shrink-0">
                  {rec.primaryImage ? (
                    <Image
                      src={rec.primaryImage}
                      alt={rec.primaryImageAlt ?? rec.name}
                      width={48}
                      height={48}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground text-xs">—</div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/catalog/${rec.slug}`} onClick={onClose}>
                    <p className="text-xs font-medium truncate hover:text-primary transition-colors leading-snug">
                      {rec.name}
                    </p>
                  </Link>
                  <p className="text-xs text-muted-foreground">{v.weight} · {v.price}₽</p>
                </div>
                <button
                  onClick={() => handleAdd(rec)}
                  disabled={v.stock <= 0}
                  className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                    justAdded
                      ? "bg-green-500 text-white"
                      : "bg-primary text-white hover:bg-primary/90"
                  }`}
                  title="В корзину"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
      </div>
    </div>
  )
}
