"use client"

import { useState } from "react"
import { ShoppingCart, Check } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"
import { useCartUIStore } from "@/lib/store/cart-ui"

interface Props {
  productId: string
  variantId: string
  name: string
  weight: string
  price: number
  image: string | null
  slug: string
  stock: number
}

export function FeaturedBuyButton({ productId, variantId, name, weight, price, image, slug, stock }: Props) {
  const addItem = useCartStore((s) => s.addItem)
  const openDrawer = useCartUIStore((s) => s.openDrawer)
  const [added, setAdded] = useState(false)

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (stock <= 0) return

    addItem({ productId, variantId, name, weight, price, image, quantity: 1, slug })
    openDrawer()
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  if (stock <= 0) {
    return (
      <span className="h-9 px-4 bg-muted text-muted-foreground rounded-lg text-sm font-medium flex items-center">
        Нет в наличии
      </span>
    )
  }

  return (
    <button
      onClick={handleClick}
      className="h-9 px-4 bg-primary text-white rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
    >
      {added ? (
        <>
          <Check className="w-4 h-4" />
          Добавлено
        </>
      ) : (
        <>
          <ShoppingCart className="w-4 h-4" />
          Купить
        </>
      )}
    </button>
  )
}
