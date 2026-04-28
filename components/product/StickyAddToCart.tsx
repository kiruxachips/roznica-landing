"use client"

import { useState, useEffect, useRef } from "react"
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

interface StickyAddToCartProps {
  productId: string
  productName: string
  productSlug: string
  productImage: string | null
  variants: Variant[]
  /** Ref to the main WeightSelector cart button — bar appears when it scrolls out of view */
  triggerRef: React.RefObject<HTMLElement | null>
  /** I7: контролируемый index (общий с WeightSelector). Если undefined —
   *  fallback на собственный state (для случаев standalone-использования). */
  selectedIndex?: number
  onSelectIndex?: (idx: number) => void
}

export function StickyAddToCart({
  productId,
  productName,
  productSlug,
  productImage,
  variants,
  triggerRef,
  selectedIndex: controlledIndex,
  onSelectIndex,
}: StickyAddToCartProps) {
  const [visible, setVisible] = useState(false)
  const [uncontrolledIndex, setUncontrolledIndex] = useState(variants.length - 1)
  const selectedIndex = controlledIndex ?? uncontrolledIndex
  const setSelectedIndex = onSelectIndex ?? setUncontrolledIndex
  const [added, setAdded] = useState(false)
  const addItem = useCartStore((s) => s.addItem)
  const openDrawer = useCartUIStore((s) => s.openDrawer)
  const selected = variants[selectedIndex]

  useEffect(() => {
    const el = triggerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [triggerRef])

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
      stockSnapshot: selected.stock,
    })
    openDrawer()
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  // M7: если выбранный вариант OOS — скрываем sticky bar полностью.
  // Кнопка «Нет в наличии» в основной WeightSelector уже сообщает юзеру,
  // sticky-bar дублирует визуальный шум.
  const allOos = variants.every((v) => v.stock === 0)

  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.08)] transition-transform duration-300 pb-[env(safe-area-inset-bottom)]",
        visible && !allOos ? "translate-y-0" : "translate-y-full"
      )}
      aria-hidden={allOos || !visible}
    >
      <div className="container mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-3 py-2.5 sm:py-3">
          {/* Product name */}
          <div className="flex-1 min-w-0 hidden md:block">
            <p className="text-sm font-semibold text-foreground truncate">{productName}</p>
            <p className="text-xs text-muted-foreground">{selected.weight}</p>
          </div>

          {/* Weight pills */}
          <div className="flex gap-1 sm:gap-1.5 overflow-x-auto -mx-1 px-1 scrollbar-hide flex-shrink min-w-0">
            {variants.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setSelectedIndex(i)}
                disabled={v.stock === 0}
                className={cn(
                  "px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex-shrink-0",
                  i === selectedIndex
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/30",
                  v.stock === 0 && "opacity-40 cursor-not-allowed"
                )}
              >
                {v.weight}
              </button>
            ))}
          </div>

          {/* Price + CTA */}
          <button
            onClick={handleAddToCart}
            disabled={selected.stock === 0}
            className={cn(
              "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] whitespace-nowrap shrink-0 ml-auto",
              added
                ? "bg-green-600 text-white"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
              selected.stock === 0 && "opacity-50 cursor-not-allowed"
            )}
          >
            {added ? (
              "Добавлено!"
            ) : (
              <>
                <span>{selected.price}₽</span>
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden sm:inline">В корзину</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
