import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CartItem } from "@/lib/types"

interface CartState {
  items: CartItem[]
  promoCode: string | null
  promoDiscount: number
  promoType: "percent" | "fixed" | null
  promoValue: number | null
  addItem: (item: CartItem) => void
  removeItem: (variantId: string) => void
  updateQuantity: (variantId: string, quantity: number) => void
  clearCart: () => void
  totalItems: () => number
  totalPrice: () => number
  setPromo: (code: string, type: "percent" | "fixed", value: number, discount: number) => void
  clearPromo: () => void
}

function calcSubtotal(items: CartItem[]) {
  return items.reduce((sum, i) => sum + i.price * i.quantity, 0)
}

function recalcPromoDiscount(
  items: CartItem[],
  promoType: "percent" | "fixed" | null,
  promoValue: number | null
): number {
  if (!promoType || promoValue === null) return 0
  const subtotal = calcSubtotal(items)
  if (promoType === "percent") {
    return Math.round(subtotal * promoValue / 100)
  }
  return Math.min(promoValue, subtotal)
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      promoCode: null,
      promoDiscount: 0,
      promoType: null,
      promoValue: null,

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.variantId === item.variantId)
          const newItems = existing
            ? state.items.map((i) =>
                i.variantId === item.variantId ? { ...i, quantity: i.quantity + item.quantity } : i
              )
            : [...state.items, item]
          return {
            items: newItems,
            promoDiscount: recalcPromoDiscount(newItems, state.promoType, state.promoValue),
          }
        }),

      removeItem: (variantId) =>
        set((state) => {
          const newItems = state.items.filter((i) => i.variantId !== variantId)
          return {
            items: newItems,
            promoDiscount: recalcPromoDiscount(newItems, state.promoType, state.promoValue),
          }
        }),

      updateQuantity: (variantId, quantity) =>
        set((state) => {
          const newItems =
            quantity <= 0
              ? state.items.filter((i) => i.variantId !== variantId)
              : state.items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i))
          return {
            items: newItems,
            promoDiscount: recalcPromoDiscount(newItems, state.promoType, state.promoValue),
          }
        }),

      clearCart: () =>
        set({
          items: [],
          promoCode: null,
          promoDiscount: 0,
          promoType: null,
          promoValue: null,
        }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      totalPrice: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      setPromo: (code, type, value, discount) =>
        set({
          promoCode: code,
          promoType: type,
          promoValue: value,
          promoDiscount: discount,
        }),

      clearPromo: () =>
        set({
          promoCode: null,
          promoDiscount: 0,
          promoType: null,
          promoValue: null,
        }),
    }),
    {
      name: "millor-cart",
    }
  )
)
