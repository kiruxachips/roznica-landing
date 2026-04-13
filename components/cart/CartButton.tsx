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
      className="relative w-10 h-10 rounded-xl flex items-center justify-center text-foreground hover:bg-muted transition-colors"
      aria-label="Корзина"
    >
      <ShoppingCart className="w-5 h-5" strokeWidth={1.75} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  )
}
