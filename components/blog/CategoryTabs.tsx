import Link from "next/link"
import type { ArticleCategoryInfo } from "@/lib/types"

interface CategoryTabsProps {
  categories: ArticleCategoryInfo[]
  activeCategory?: string
}

export function CategoryTabs({ categories, activeCategory }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 mb-6 sm:mb-8 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
      <Link
        href="/blog"
        className={`px-3.5 sm:px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
          !activeCategory
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
        }`}
      >
        Все статьи
      </Link>
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={`/blog?category=${cat.slug}`}
          className={`px-3.5 sm:px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
            activeCategory === cat.slug
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:bg-secondary/80"
          }`}
        >
          {cat.name}
          <span className="ml-1.5 text-xs opacity-70">{cat.articleCount}</span>
        </Link>
      ))}
    </div>
  )
}
