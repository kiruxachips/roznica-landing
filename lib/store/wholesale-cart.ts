"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface WholesaleCartItem {
  productId: string
  variantId: string
  name: string
  weight: string
  slug: string
  image: string | null
  unitPrice: number
  unitOldPrice: number | null
  quantity: number
  minQuantity: number
  stock: number
}

interface WholesaleCartState {
  items: WholesaleCartItem[]
  addItem: (item: WholesaleCartItem) => void
  updateQuantity: (variantId: string, quantity: number) => void
  updateItemPrice: (variantId: string, unitPrice: number, unitOldPrice: number | null, stock: number, minQuantity: number) => void
  removeItem: (variantId: string) => void
  clearCart: () => void
  totalItems: () => number
  totalPrice: () => number
}

export const useWholesaleCart = create<WholesaleCartState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            }
          }
          return { items: [...state.items, item] }
        }),
      updateQuantity: (variantId, quantity) =>
        set((state) => ({
          items: state.items
            .map((i) => (i.variantId === variantId ? { ...i, quantity: Math.max(1, quantity) } : i))
            .filter((i) => i.quantity > 0),
        })),
      updateItemPrice: (variantId, unitPrice, unitOldPrice, stock, minQuantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.variantId === variantId ? { ...i, unitPrice, unitOldPrice, stock, minQuantity } : i
          ),
        })),
      removeItem: (variantId) =>
        set((state) => ({ items: state.items.filter((i) => i.variantId !== variantId) })),
      clearCart: () => set({ items: [] }),
      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () => get().items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
    }),
    { name: "millor-wholesale-cart", version: 1 }
  )
)
