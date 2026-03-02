import Link from "next/link"
import type { ArticleCategoryInfo } from "@/lib/types"

interface CategoryTabsProps {
  categories: ArticleCategoryInfo[]
  activeCategory?: string
}

export function CategoryTabs({ categories, activeCategory }: CategoryTabsProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-8">
      <Link
        href="/blog"
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
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
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
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
