"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"

interface ProductGalleryProps {
  images: { id: string; url: string; alt: string | null; isPrimary: boolean }[]
  productName: string
}

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const sorted = [...images].sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0))
  const [activeIndex, setActiveIndex] = useState(0)

  if (sorted.length === 0) {
    return (
      <div className="aspect-square rounded-2xl bg-secondary/50 flex items-center justify-center text-muted-foreground">
        Нет изображений
      </div>
    )
  }

  return (
    <>
      {/* Mobile: main image then thumbnails below */}
      <div className="lg:hidden space-y-4">
        <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-neutral-50">
          <Image
            src={sorted[activeIndex].url}
            alt={sorted[activeIndex].alt ?? productName}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        </div>
        {sorted.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {sorted.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors",
                  i === activeIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <Image src={img.url} alt={img.alt ?? ""} fill className="object-cover" sizes="80px" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: thumbnails on left, main image on right */}
      <div className="hidden lg:flex gap-3">
        {sorted.length > 1 && (
          <div className="flex flex-col gap-3 w-20 flex-shrink-0">
            {sorted.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors",
                  i === activeIndex ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <Image src={img.url} alt={img.alt ?? ""} fill className="object-cover" sizes="80px" />
              </button>
            ))}
          </div>
        )}
        <div className="relative flex-1 aspect-[4/5] rounded-2xl overflow-hidden bg-neutral-50">
          <Image
            src={sorted[activeIndex].url}
            alt={sorted[activeIndex].alt ?? productName}
            fill
            className="object-cover"
            sizes="50vw"
            priority
          />
        </div>
      </div>
    </>
  )
}
