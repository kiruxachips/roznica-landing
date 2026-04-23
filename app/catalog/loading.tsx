import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { ProductGridSkeleton } from "@/components/catalog/ProductCardSkeleton"

/**
 * Next автоматически показывает этот экран при server-rendering'е /catalog.
 * Форма скелетонов повторяет реальный layout: title, filter bar, сетка из
 * 12 карточек точного размера — при hydration перехода нет визуального
 * прыжка и дёрганья layout.
 */
export default function CatalogLoading() {
  return (
    <>
      <Header />
      <main className="pt-20 sm:pt-24 pb-12 sm:pb-16 bg-secondary/20 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Title */}
          <div className="mb-5 sm:mb-8">
            <div className="h-8 sm:h-10 w-48 bg-muted rounded animate-pulse" />
            <div className="mt-2 h-4 w-32 bg-muted/60 rounded animate-pulse" />
          </div>

          {/* Filter bar */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-5 flex gap-2 overflow-hidden">
            <div className="h-9 flex-1 max-w-xs bg-muted rounded-lg animate-pulse" />
            <div className="h-9 w-20 bg-muted rounded-lg animate-pulse" />
            <div className="h-9 w-24 bg-muted rounded-lg animate-pulse hidden sm:block" />
          </div>

          <ProductGridSkeleton count={12} />
        </div>
      </main>
      <Footer />
    </>
  )
}
