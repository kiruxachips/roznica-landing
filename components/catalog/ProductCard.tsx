import Image from "next/image"
import Link from "next/link"
import { Star, MapPin, Flame } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { FavoriteButton } from "@/components/account/FavoriteButton"
import type { ProductCard as ProductCardType } from "@/lib/types"

interface ProductCardProps {
  product: ProductCardType
  favorited?: boolean
}

export function ProductCard({ product, favorited }: ProductCardProps) {
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
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4">
          {/* Rating */}
          {product.averageRating && (
            <div className="flex items-center gap-0.5 mb-1.5">
              {Array.from({ length: Math.round(product.averageRating) }).map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
              ))}
              <span className="text-[11px] text-muted-foreground ml-1">({product.reviewCount})</span>
            </div>
          )}

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

          {/* Price */}
          <div className="flex items-baseline gap-1.5">
            {product.minPrice && (
              <span className="text-base font-bold text-primary">
                от {product.minPrice}₽
              </span>
            )}
            {product.minOldPrice && product.minOldPrice > (product.minPrice ?? 0) && (
              <span className="text-xs text-muted-foreground line-through">
                {product.minOldPrice}₽
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
