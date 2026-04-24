"use client"

import { useState } from "react"
import { useWholesaleCart } from "@/lib/store/wholesale-cart"

interface Props {
  productId: string
  variantId: string
  name: string
  weight: string
  slug: string
  image: string | null
  unitPrice: number
  unitOldPrice: number | null
  minQuantity: number
  stock: number
}

export function AddToWholesaleCartButton(props: Props) {
  const addItem = useWholesaleCart((s) => s.addItem)
  const [added, setAdded] = useState(false)

  const disabled = props.stock <= 0

  function handleAdd() {
    addItem({
      productId: props.productId,
      variantId: props.variantId,
      name: props.name,
      weight: props.weight,
      slug: props.slug,
      image: props.image,
      unitPrice: props.unitPrice,
      unitOldPrice: props.unitOldPrice,
      quantity: props.minQuantity,
      minQuantity: props.minQuantity,
      stock: props.stock,
    })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  if (disabled) {
    return (
      <span className="text-xs text-red-600 font-medium">Нет в наличии</span>
    )
  }

  return (
    <button
      onClick={handleAdd}
      className="shrink-0 rounded-lg bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 hover:bg-primary/90 transition-colors"
    >
      {added ? "✓ Добавлено" : `+ ${props.minQuantity}`}
    </button>
  )
}
