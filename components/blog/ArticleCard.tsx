import Link from "next/link"
import Image from "next/image"
import type { ArticleCard as ArticleCardType } from "@/lib/types"
import { Calendar, Clock } from "lucide-react"

export function ArticleCard({ article }: { article: ArticleCardType }) {
  return (
    <Link href={`/blog/${article.slug}`} className="group block h-full">
      <article className="bg-white rounded-xl overflow-hidden border border-border shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
        {/* Cover image */}
        <div className="relative aspect-[16/9] overflow-hidden bg-muted">
          {article.coverImage?.endsWith(".mp4") ? (
            <video
              src={article.coverImage}
              muted
              autoPlay
              loop
              playsInline
              className="w-full h-full object-cover"
            />
          ) : article.coverImage ? (
            <Image
              src={article.coverImage}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-secondary to-muted" />
          )}
          {article.category && (
            <span className="absolute top-3 left-3 px-2.5 py-1 bg-primary text-primary-foreground rounded-md text-xs font-medium">
              {article.category.name}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 flex flex-col flex-1">
          <h3 className="font-serif text-lg font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors mb-2">
            {article.title}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {article.excerpt}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-auto pt-2">
            {article.publishedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(article.publishedAt).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {article.readingTime} мин
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
