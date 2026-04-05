"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Star, MapPin, Flame, ShoppingCart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { FavoriteButton } from "@/components/account/FavoriteButton"
import { useCartStore } from "@/lib/store/cart"
import { useCartUIStore } from "@/lib/store/cart-ui"
import type { ProductCard as ProductCardType } from "@/lib/types"

interface ProductCardProps {
  product: ProductCardType
  favorited?: boolean
}

export function ProductCard({ product, favorited }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem)
  const openDrawer = useCartUIStore((s) => s.openDrawer)

  const variants = product.variants ?? (product.firstVariant ? [product.firstVariant] : [])
  const availableVariants = variants.filter((v) => v.stock > 0)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const selected = availableVariants[selectedIdx] || variants[0]
  const outOfStock = availableVariants.length === 0

  function handleQuickAdd(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!selected || selected.stock <= 0) return
    addItem({
      productId: product.id,
      variantId: selected.id,
      name: product.name,
      weight: selected.weight,
      price: selected.price,
      image: product.primaryImage,
      quantity: 1,
      slug: product.slug,
    })
    openDrawer()
  }

  function handleVariantClick(e: React.MouseEvent, idx: number) {
    e.preventDefault()
    e.stopPropagation()
    setSelectedIdx(idx)
  }

  return (
    <Link href={`/catalog/${product.slug}`} className="group block">
      <div className="overflow-hidden rounded-xl bg-white border border-border/50 shadow-sm hover:shadow-md transition-all duration-300">
        {/* Image */}
        <div className="relative aspect-[4/5] bg-neutral-50 overflow-hidden">
          {product.primaryImage ? (
            <Image
              src={product.primaryImage}
              alt={product.primaryImageAlt ?? product.name}
              fill
              className="object-cover object-top group-hover:scale-105 transition-transform duration-500"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              Нет фото
            </div>
          )}
          {product.badge && (
            <Badge className="absolute top-2.5 left-2.5 z-10 bg-white text-foreground border-0 shadow-sm text-xs font-semibold">
              {product.badge}
            </Badge>
          )}
          {favorited !== undefined && (
            <div className="absolute top-2.5 right-2.5 z-10">
              <FavoriteButton productId={product.id} isFavorited={favorited} />
            </div>
          )}
          {outOfStock && (
            <div className={`absolute top-2.5 ${favorited !== undefined ? "left-auto right-2.5 top-12" : "right-2.5"} z-10`}>
              <Badge className="bg-red-50 text-red-700 border-0 shadow-sm text-xs font-semibold">
                Нет в наличии
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4">
          {/* Rating */}
          <div className="flex items-center gap-0.5 mb-1.5">
            {Array.from({ length: 5 }).map((_, i) => {
              const filled = product.averageRating !== null && i < Math.round(product.averageRating)
              return (
                <Star
                  key={i}
                  className={filled ? "w-3 h-3 fill-amber-400 text-amber-400" : "w-3 h-3 text-muted-foreground/30"}
                />
              )
            })}
            {product.reviewCount > 0 && (
              <span className="text-[11px] text-muted-foreground ml-1">({product.reviewCount})</span>
            )}
          </div>

          {/* Name */}
          <h3 className="font-serif text-sm sm:text-base font-bold text-foreground mb-1 group-hover:text-primary transition-colors line-clamp-2">
            {product.name}
          </h3>

          {/* Meta */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            {product.origin && (
              <span className="flex items-center gap-0.5">
                <MapPin className="w-3 h-3" />
                {product.origin}
              </span>
            )}
            {product.roastLevel && (
              <span className="flex items-center gap-0.5">
                <Flame className="w-3 h-3" />
                {product.roastLevel}
              </span>
            )}
          </div>

          {/* Flavor notes */}
          {product.flavorNotes.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2.5">
              {product.flavorNotes.slice(0, 3).map((note) => (
                <span key={note} className="px-2 py-0.5 rounded-full bg-secondary text-[11px] text-muted-foreground">
                  {note}
                </span>
              ))}
              {product.flavorNotes.length > 3 && (
                <span className="px-2 py-0.5 rounded-full bg-secondary text-[11px] text-muted-foreground">
                  +{product.flavorNotes.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Variant selector + price + add to cart */}
          {availableVariants.length > 1 ? (
            <div className="space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {availableVariants.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={(e) => handleVariantClick(e, i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      selectedIdx === i
                        ? "bg-primary text-white"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {v.weight}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-primary">
                  {selected?.price}₽
                </span>
                <button
                  onClick={handleQuickAdd}
                  className="h-10 px-4 bg-primary text-white rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                  В корзину
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-1.5">
                {selected && (
                  <span className="text-lg font-bold text-primary">
                    {selected.price}₽
                  </span>
                )}
              </div>
              {!outOfStock && selected && (
                <button
                  onClick={handleQuickAdd}
                  className="h-10 px-4 bg-primary text-white rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                  В корзину
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
