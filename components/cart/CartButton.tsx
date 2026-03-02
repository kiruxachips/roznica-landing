"use client"

import { ShoppingCart } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"
import { useState, useEffect } from "react"

export function CartButton({ onClick }: { onClick: () => void }) {
  const totalItems = useCartStore((s) => s.totalItems)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const count = mounted ? totalItems() : 0

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-lg hover:bg-muted transition-colors"
      aria-label="Корзина"
    >
      <ShoppingCart className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  )
}
