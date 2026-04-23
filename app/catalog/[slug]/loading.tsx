import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

/**
 * Скелетон страницы товара. Повторяет реальный layout: галерея слева,
 * блок с названием/вариантами/ценой справа, ниже — рейтинг и связанные.
 */
export default function ProductLoading() {
  return (
    <>
      <Header />
      <main className="pt-20 sm:pt-24 pb-12 sm:pb-16 bg-secondary/20 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumbs */}
          <div className="mb-5 h-3 w-64 rounded bg-muted animate-pulse" />

          <div className="grid lg:grid-cols-2 gap-6 lg:gap-10 bg-white rounded-2xl shadow-sm p-4 sm:p-6 lg:p-8">
            {/* Gallery */}
            <div className="space-y-3">
              <div className="aspect-[4/5] rounded-2xl bg-muted animate-pulse" />
              <div className="flex gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="w-16 h-16 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-4">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-9 w-3/4 bg-muted rounded animate-pulse" />
              <div className="h-4 w-40 bg-muted rounded animate-pulse" />

              {/* Chips */}
              <div className="flex gap-2 pt-2">
                <div className="h-6 w-16 bg-muted rounded-full animate-pulse" />
                <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
                <div className="h-6 w-14 bg-muted rounded-full animate-pulse" />
              </div>

              {/* Description */}
              <div className="space-y-2 pt-2">
                <div className="h-4 w-full bg-muted rounded animate-pulse" />
                <div className="h-4 w-5/6 bg-muted rounded animate-pulse" />
                <div className="h-4 w-4/6 bg-muted rounded animate-pulse" />
              </div>

              {/* Variant selector */}
              <div className="flex gap-2 pt-4">
                <div className="h-10 w-20 bg-muted rounded-lg animate-pulse" />
                <div className="h-10 w-20 bg-muted rounded-lg animate-pulse" />
              </div>

              {/* Price + CTA */}
              <div className="h-10 w-32 bg-muted rounded animate-pulse mt-4" />
              <div className="h-12 w-full bg-primary/20 rounded-xl animate-pulse" />
            </div>
          </div>

          {/* Reviews skeleton */}
          <div className="mt-8 bg-white rounded-2xl shadow-sm p-4 sm:p-6">
            <div className="h-6 w-40 bg-muted rounded animate-pulse mb-4" />
            <div className="grid md:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-secondary/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-muted rounded-full animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-16 bg-muted rounded mt-1 animate-pulse" />
                    </div>
                  </div>
                  <div className="h-3 w-full bg-muted rounded animate-pulse" />
                  <div className="h-3 w-4/5 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
