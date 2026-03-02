import { Star } from "lucide-react"

interface Review {
  id: string
  name: string
  text: string
  rating: number
  date: string | null
  createdAt: Date
}

export function ReviewsList({ reviews }: { reviews: Review[] }) {
  return (
    <div>
      <h2 className="font-serif text-2xl font-bold mb-8">
        Отзывы покупателей ({reviews.length})
      </h2>
      <div className="space-y-6 max-w-2xl">
        {reviews.map((review) => (
          <div key={review.id} className="bg-secondary/30 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-semibold text-foreground">{review.name}</p>
                <p className="text-xs text-muted-foreground">{review.date ?? new Date(review.createdAt).toLocaleDateString("ru-RU")}</p>
              </div>
              <div className="flex">
                {Array.from({ length: review.rating }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">{review.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
