/**
 * Скелетон карточки товара — форма повторяет реальную ProductCard
 * (image 4/5, заголовок в 2 строки, мета-строка, чипсы, цена+кнопка),
 * чтобы переход в реальный контент не прыгал. animate-pulse + tailwind
 * `bg-muted` достаточно, без JS shimmer-библиотек.
 */
export function ProductCardSkeleton() {
  return (
    <div className="h-full flex flex-col overflow-hidden rounded-xl bg-white border border-border/60 shadow-sm animate-pulse">
      <div className="aspect-[4/5] bg-muted" />
      <div className="p-3 sm:p-4 flex flex-col flex-1 gap-2">
        <div className="h-4 w-20 bg-muted rounded" />
        <div className="h-4 w-11/12 bg-muted rounded" />
        <div className="h-4 w-8/12 bg-muted rounded" />
        <div className="h-3 w-6/12 bg-muted rounded mt-1" />
        <div className="flex gap-1 mt-1">
          <div className="h-5 w-14 bg-muted rounded-full" />
          <div className="h-5 w-14 bg-muted rounded-full" />
        </div>
        <div className="mt-auto pt-2 border-t border-border/40 flex items-center justify-between">
          <div className="h-5 w-14 bg-muted rounded" />
          <div className="h-8 w-8 sm:w-24 bg-muted rounded-lg" />
        </div>
      </div>
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}
