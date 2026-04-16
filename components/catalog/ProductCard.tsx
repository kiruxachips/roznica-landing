"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Star, ShoppingCart } from "lucide-react"
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

  // Build meta line and chips based on product type
  let metaLine = ""
  let chips: string[] = []

  if (product.productType === "tea") {
    metaLine = [product.roastLevel, product.origin].filter(Boolean).join(" · ")
    chips = product.flavorNotes
  } else if (product.productType === "instant") {
    metaLine = product.productForm ?? ""
    chips = []
  } else {
    // coffee (default)
    metaLine = [product.origin, product.roastLevel].filter(Boolean).join(" · ")
    chips = product.flavorNotes
  }

  return (
    <Link href={`/catalog/${product.slug}`} className="group block h-full">
      <div className="h-full flex flex-col overflow-hidden rounded-xl bg-white border border-border/60 shadow-sm hover:shadow-md hover:border-border transition-all duration-300">
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
            <Badge className="absolute top-2 left-2 z-10 bg-primary text-white border-0 shadow-sm text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 uppercase tracking-wide">
              {product.badge}
            </Badge>
          )}
          {favorited !== undefined && (
            <div className="absolute top-2 right-2 z-10">
              <FavoriteButton productId={product.id} isFavorited={favorited} />
            </div>
          )}
          {outOfStock && (
            <div className="absolute bottom-2 left-2 z-10">
              <Badge className="bg-red-50 text-red-700 border-0 shadow-sm text-[10px] sm:text-[11px] font-semibold px-2 py-0.5">
                Нет в наличии
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 flex flex-col flex-1 gap-1.5 sm:gap-2">
          {/* Rating — fixed height for alignment */}
          <div className="flex items-center gap-0.5 h-4">
            {product.averageRating !== null ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => {
                  const filled = i < Math.round(product.averageRating!)
                  return (
                    <Star
                      key={i}
                      className={filled ? "w-3 h-3 fill-amber-400 text-amber-400" : "w-3 h-3 fill-muted text-muted"}
                    />
                  )
                })}
                {product.reviewCount > 0 && (
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground ml-1">({product.reviewCount})</span>
                )}
              </>
            ) : (
              <span className="text-[10px] sm:text-[11px] text-muted-foreground">Нет отзывов</span>
            )}
          </div>

          {/* Name — 2 lines forced for card height uniformity */}
          <h3 className="font-serif text-sm sm:text-base font-bold text-foreground leading-snug line-clamp-2 min-h-[2.25rem] sm:min-h-[2.5rem] group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          {/* Origin · roast — single line */}
          <p className="text-[11px] sm:text-xs text-muted-foreground truncate min-h-[1rem]">
            {metaLine || "\u00A0"}
          </p>

          {/* Flavor notes / product form chips */}
          <div className="flex flex-wrap gap-1 min-h-[20px]">
            {chips.slice(0, 2).map((note) => (
              <span
                key={note}
                className="px-1.5 sm:px-2 py-0.5 rounded-full bg-secondary text-[10px] sm:text-[11px] text-muted-foreground truncate max-w-full"
              >
                {note}
              </span>
            ))}
            {chips.length > 2 && (
              <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-secondary text-[10px] sm:text-[11px] text-muted-foreground">
                +{chips.length - 2}
              </span>
            )}
          </div>

          {/* Variant selector + price + add to cart */}
          <div className="mt-auto pt-2 space-y-2 border-t border-border/40">
            {availableVariants.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {availableVariants.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={(e) => handleVariantClick(e, i)}
                    className={`px-2 py-1 sm:px-2.5 sm:py-1 rounded-md text-[11px] sm:text-xs font-medium transition-colors ${
                      selectedIdx === i
                        ? "bg-primary text-white"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {v.weight}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-1 min-w-0">
                {selected && (
                  <span className="text-base sm:text-lg font-bold text-primary leading-none">
                    {selected.price}₽
                  </span>
                )}
                {selected?.oldPrice && selected.oldPrice > selected.price && (
                  <span className="text-[11px] sm:text-xs text-muted-foreground line-through truncate">
                    {selected.oldPrice}₽
                  </span>
                )}
              </div>
              {!outOfStock && selected && (
                <button
                  onClick={handleQuickAdd}
                  aria-label="В корзину"
                  className="shrink-0 h-9 w-9 sm:h-10 sm:w-auto sm:px-4 bg-primary text-white rounded-lg text-sm font-medium flex items-center justify-center sm:gap-1.5 hover:bg-primary/90 transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="hidden sm:inline">В корзину</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
