"use client"

import { useState } from "react"
import { RotateCcw } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"

interface OrderItem {
  productId: string | null
  variantId: string | null
  name: string
  weight: string
  price: number
  quantity: number
}

interface Props {
  items: OrderItem[]
}

export function ReorderButton({ items }: Props) {
  const addItem = useCartStore((s) => s.addItem)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleReorder() {
    const variantIds = items
      .map((i) => i.variantId)
      .filter((id): id is string => !!id)

    if (variantIds.length === 0) {
      setMessage("Товары больше недоступны")
      return
    }

    setLoading(true)
    setMessage("")

    try {
      const res = await fetch("/api/variants/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantIds }),
      })
      const data = await res.json()

      let added = 0
      for (const av of data.available) {
        const original = items.find((i) => i.variantId === av.variantId)
        addItem({
          productId: av.productId,
          variantId: av.variantId,
          name: av.name,
          weight: av.weight,
          price: av.price,
          image: av.image,
          quantity: original?.quantity ?? 1,
          slug: av.slug,
        })
        added++
      }

      if (data.unavailable.length > 0 && added > 0) {
        setMessage(`Добавлено ${added} из ${items.length} товаров. Некоторые недоступны.`)
      } else if (data.unavailable.length > 0 && added === 0) {
        setMessage("Все товары из заказа недоступны")
      } else {
        setMessage("Товары добавлены в корзину!")
      }
    } catch {
      setMessage("Ошибка при добавлении товаров")
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(""), 4000)
    }
  }

  return (
    <div>
      <button
        onClick={handleReorder}
        disabled={loading}
        className="inline-flex items-center gap-2 h-10 px-5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        <RotateCcw className="w-4 h-4" />
        {loading ? "Добавление..." : "Повторить заказ"}
      </button>
      {message && (
        <p className="text-sm text-muted-foreground mt-2">{message}</p>
      )}
    </div>
  )
}
