"use client"

import { useState, useTransition } from "react"
import { Heart } from "lucide-react"
import { toggleFavorite } from "@/lib/actions/favorites"
import { cn } from "@/lib/utils"

interface FavoriteButtonProps {
  productId: string
  isFavorited: boolean
  className?: string
}

export function FavoriteButton({ productId, isFavorited, className }: FavoriteButtonProps) {
  const [optimistic, setOptimistic] = useState(isFavorited)
  const [isPending, startTransition] = useTransition()

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()

    setOptimistic(!optimistic)
    startTransition(async () => {
      const result = await toggleFavorite(productId)
      if (result.error) {
        setOptimistic(isFavorited)
      } else {
        setOptimistic(result.favorited ?? !optimistic)
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center transition-all",
        optimistic
          ? "bg-red-50 text-red-500 hover:bg-red-100"
          : "bg-white/80 text-muted-foreground hover:bg-white hover:text-red-500",
        "shadow-sm backdrop-blur-sm",
        className
      )}
      aria-label={optimistic ? "Убрать из избранного" : "Добавить в избранное"}
    >
      <Heart className={cn("w-4 h-4", optimistic && "fill-current")} />
    </button>
  )
}
