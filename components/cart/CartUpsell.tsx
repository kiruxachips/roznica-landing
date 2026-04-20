"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ShoppingCart } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"
import { useCartUIStore } from "@/lib/store/cart-ui"
import type { ProductCard } from "@/lib/types"

let upsellCache: ProductCard[] | null = null

interface CartUpsellProps {
  cartProductIds: string[]
  onClose: () => void
  variant?: "drawer" | "page"
}

export function CartUpsell({ cartProductIds, onClose, variant = "drawer" }: CartUpsellProps) {
  const [products, setProducts] = useState<ProductCard[]>(upsellCache ?? [])
  const addItem = useCartStore((s) => s.addItem)
  const openDrawer = useCartUIStore((s) => s.openDrawer)
  const [addedId, setAddedId] = useState<string | null>(null)

  useEffect(() => {
    if (upsellCache) {
      setProducts(upsellCache)
      return
    }
    fetch("/api/catalog/products?sort=popular&limit=9&type=all")
      .then((r) => r.json())
      .then((data) => {
        const filtered: ProductCard[] = (data.products ?? [])
          .filter((p: ProductCard) => !cartProductIds.includes(p.id))
          .slice(0, variant === "page" ? 4 : 3)
        upsellCache = filtered
        setProducts(filtered)
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (products.length === 0) return null

  function handleAdd(product: ProductCard) {
    const variant = product.firstVariant
    if (!variant || variant.stock <= 0) return
    addItem({
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      weight: variant.weight,
      price: variant.price,
      image: product.primaryImage,
      quantity: 1,
      slug: product.slug,
    })
    setAddedId(variant.id)
    setTimeout(() => setAddedId(null), 1500)
  }

  return (
    <div className="mt-1 rounded-2xl border border-border/60 bg-secondary/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2.5">Попробуйте также</p>
      <div className="space-y-1.5">
        {products.map((product) => {
          const v = product.firstVariant
          const inCart = cartProductIds.includes(product.id)
          const justAdded = addedId === v?.id
          return (
            <div key={product.id} className="flex items-center gap-3 bg-white rounded-xl p-2.5">
              <Link href={`/catalog/${product.slug}`} onClick={onClose} className="shrink-0">
                {product.primaryImage ? (
                  <Image
                    src={product.primaryImage}
                    alt={product.primaryImageAlt ?? product.name}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground text-xs">
                    —
                  </div>
                )}
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/catalog/${product.slug}`} onClick={onClose}>
                  <p className="text-xs font-medium truncate hover:text-primary transition-colors leading-snug">
                    {product.name}
                  </p>
                </Link>
                {v && (
                  <p className="text-xs text-muted-foreground">{v.weight} · {v.price}₽</p>
                )}
              </div>
              <button
                onClick={() => handleAdd(product)}
                disabled={!v || v.stock <= 0 || inCart}
                className={`shrink-0 h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                  justAdded
                    ? "bg-green-500 text-white"
                    : inCart
                    ? "bg-secondary text-muted-foreground cursor-default"
                    : "bg-primary text-white hover:bg-primary/90"
                }`}
                title={inCart ? "Уже в корзине" : "В корзину"}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
