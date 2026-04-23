"use client"

import { useRef } from "react"
import { WeightSelector } from "@/components/product/WeightSelector"
import { StickyAddToCart } from "@/components/product/StickyAddToCart"
import { Leaf, Zap, Truck } from "lucide-react"

interface Variant {
  id: string
  weight: string
  price: number
  oldPrice: number | null
  stock: number
}

interface ProductClientSectionProps {
  variants: Variant[]
  productId: string
  productName: string
  productSlug: string
  productImage: string | null
}

export function ProductClientSection({
  variants,
  productId,
  productName,
  productSlug,
  productImage,
}: ProductClientSectionProps) {
  const cartButtonRef = useRef<HTMLElement | null>(null)

  return (
    <>
      <div ref={(el) => { cartButtonRef.current = el }}>
        <WeightSelector
          variants={variants}
          productId={productId}
          productName={productName}
          productSlug={productSlug}
          productImage={productImage}
        />
      </div>

      {/* Trust signals */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Leaf className="w-3.5 h-3.5 text-primary" />
          Свежая обжарка
        </span>
        <span className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-primary" />
          Упаковка в течение 24ч
        </span>
        <span className="flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-primary" />
          Доставка по всей России
        </span>
      </div>

      <StickyAddToCart
        productId={productId}
        productName={productName}
        productSlug={productSlug}
        productImage={productImage}
        variants={variants}
        triggerRef={cartButtonRef}
      />
    </>
  )
}
