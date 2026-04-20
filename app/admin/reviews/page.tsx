export const dynamic = "force-dynamic"

import Link from "next/link"
import { getAllReviews } from "@/lib/dal/reviews"
import { ReviewActions } from "./ReviewActions"
import { Star } from "lucide-react"

const PAGE_SIZE = 50

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>
}) {
  const sp = (await searchParams) ?? {}
  const page = Math.max(1, Number(sp.page) || 1)

  const { reviews, total } = await getAllReviews({ page, limit: PAGE_SIZE })
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  function pageHref(p: number) {
    return p > 1 ? `/admin/reviews?page=${p}` : "/admin/reviews"
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Отзывы</h1>

      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Автор</th>
              <th className="text-left px-4 py-3 font-medium">Товар</th>
              <th className="text-left px-4 py-3 font-medium">Рейтинг</th>
              <th className="text-left px-4 py-3 font-medium">Текст</th>
              <th className="text-left px-4 py-3 font-medium">Статус</th>
              <th className="w-24 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {reviews.map((review) => (
              <tr key={review.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <p className="font-medium">{review.name}</p>
                  <p className="text-xs text-muted-foreground">{review.date}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{review.product.name}</td>
                <td className="px-4 py-3">
                  <div className="flex">
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <Star key={`star-${review.id}-${i}`} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 max-w-xs">
                  <p className="truncate">{review.text}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${review.isVisible ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {review.isVisible ? "Виден" : "Скрыт"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <ReviewActions reviewId={review.id} reviewName={review.name} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {reviews.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">Нет отзывов</div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-muted-foreground">
            Всего: <span className="font-medium text-foreground">{total}</span> · Стр. {page} из {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={pageHref(page - 1)}
                className="px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                ← Предыдущая
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageHref(page + 1)}
                className="px-3 py-1.5 border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Следующая →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
