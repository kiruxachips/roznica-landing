"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCartStore } from "@/lib/store/cart"

interface RestoredItem {
  variantId: string
  productId: string
  name: string
  weight: string
  price: number
  quantity: number
  slug: string
  image?: string | null
}

export function RestoreCartClient({ items, email }: { items: RestoredItem[]; email: string }) {
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)
  const clearCart = useCartStore((s) => s.clearCart)

  useEffect(() => {
    // Если текущая корзина что-то содержит — спросим разрешения через prompt
    // (или просто перезаписываем; решено перезаписывать, т.к. юзер кликнул
    // по deep-link с явным намерением).
    clearCart()
    for (const i of items) {
      addItem({
        productId: i.productId,
        variantId: i.variantId,
        name: i.name,
        weight: i.weight,
        price: i.price,
        quantity: i.quantity,
        slug: i.slug,
        image: i.image ?? null,
      })
    }
    // Небольшая задержка чтобы Zustand persist записался, потом редирект.
    const t = setTimeout(() => router.replace("/cart"), 300)
    return () => clearTimeout(t)
  }, [items, addItem, clearCart, router])

  return (
    <main className="container mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-2xl font-bold mb-3">Восстанавливаем вашу корзину…</h1>
      <p className="text-muted-foreground text-sm">
        Для {email.replace(/(.{1}).*(@.*)/, "$1***$2")} · {items.length} товар
        {items.length === 1 ? "" : items.length < 5 ? "а" : "ов"}
      </p>
    </main>
  )
}
