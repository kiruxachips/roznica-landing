import Link from "next/link"

export function EmptyState() {
  return (
    <div className="py-20 text-center">
      <p className="text-xl text-muted-foreground mb-4">Товары не найдены</p>
      <p className="text-sm text-muted-foreground mb-6">Попробуйте изменить фильтры или вернуться к полному каталогу</p>
      <Link
        href="/catalog"
        className="inline-flex items-center px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Показать все товары
      </Link>
    </div>
  )
}
