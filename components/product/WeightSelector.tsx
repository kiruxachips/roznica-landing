"use client"

import { useState, useRef, useEffect } from "react"
import { ShoppingCart } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"
import { useCartUIStore } from "@/lib/store/cart-ui"
import { cn } from "@/lib/utils"

interface Variant {
  id: string
  weight: string
  price: number
  oldPrice: number | null
  stock: number
}

interface WeightSelectorProps {
  variants: Variant[]
  productId: string
  productName: string
  productSlug: string
  productImage: string | null
  onVariantChange?: (variant: Variant) => void
}

export function WeightSelector({ variants, productId, productName, productSlug, productImage, onVariantChange }: WeightSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(variants.length - 1)
  const selected = variants[selectedIndex]
  const addItem = useCartStore((s) => s.addItem)
  const openDrawer = useCartUIStore((s) => s.openDrawer)
  const [added, setAdded] = useState(false)
  const cartButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    onVariantChange?.(selected)
  }, [selectedIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleAddToCart() {
    addItem({
      productId,
      variantId: selected.id,
      name: productName,
      weight: selected.weight,
      price: selected.price,
      image: productImage,
      quantity: 1,
      slug: productSlug,
    })
    openDrawer()
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="flex items-end gap-6 pt-2">
      {/* Weight */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Вес</p>
        <div className="flex gap-2">
          {variants.map((variant, i) => (
            <button
              key={variant.id}
              onClick={() => setSelectedIndex(i)}
              disabled={variant.stock === 0}
              className={cn(
                "px-6 py-4 rounded-xl text-base font-medium border-2 transition-all",
                i === selectedIndex
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/30",
                variant.stock === 0 && "opacity-40 cursor-not-allowed"
              )}
            >
              {variant.weight}
            </button>
          ))}
        </div>
      </div>

      {/* Cart button */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">В корзину</p>
        <button
          ref={cartButtonRef}
          onClick={handleAddToCart}
          disabled={selected.stock === 0}
          className={cn(
            "inline-flex flex-col items-center justify-center px-8 py-2.5 rounded-xl transition-all active:scale-[0.98]",
            added
              ? "bg-green-600 text-white"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
            selected.stock === 0 && "opacity-50 cursor-not-allowed"
          )}
        >
          {added ? (
            <span className="text-base font-semibold">Добавлено!</span>
          ) : selected.stock === 0 ? (
            <span className="text-base font-semibold">Нет в наличии</span>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{selected.price}₽</span>
              {selected.oldPrice && selected.oldPrice > selected.price && (
                <span className="text-sm opacity-70 line-through">{selected.oldPrice}₽</span>
              )}
            </div>
          )}
        </button>
      </div>
    </div>
  )
}

export { type Variant as WeightSelectorVariant }
