"use client"

import { useState } from "react"
import { ShoppingCart } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"
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
}

export function WeightSelector({ variants, productId, productName, productSlug, productImage }: WeightSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(variants.length - 1) // default to largest
  const selected = variants[selectedIndex]
  const addItem = useCartStore((s) => s.addItem)
  const [added, setAdded] = useState(false)

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
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  return (
    <div className="space-y-4 pt-2">
      {/* Weight selector */}
      <div>
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">Вес</h3>
        <div className="flex gap-2">
          {variants.map((variant, i) => (
            <button
              key={variant.id}
              onClick={() => setSelectedIndex(i)}
              disabled={variant.stock === 0}
              className={cn(
                "px-5 py-2.5 rounded-xl text-sm font-medium border-2 transition-all",
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

      {/* Price */}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-primary">{selected.price}₽</span>
        {selected.oldPrice && selected.oldPrice > selected.price && (
          <span className="text-lg text-muted-foreground line-through">{selected.oldPrice}₽</span>
        )}
      </div>

      {/* Add to cart */}
      <button
        onClick={handleAddToCart}
        disabled={selected.stock === 0}
        className={cn(
          "w-full sm:w-auto inline-flex items-center justify-center gap-2 h-14 px-10 rounded-xl text-lg font-medium transition-all",
          added
            ? "bg-green-600 text-white"
            : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]",
          selected.stock === 0 && "opacity-50 cursor-not-allowed"
        )}
      >
        <ShoppingCart className="w-5 h-5" />
        {selected.stock === 0 ? "Нет в наличии" : added ? "Добавлено!" : "В корзину"}
      </button>
    </div>
  )
}
