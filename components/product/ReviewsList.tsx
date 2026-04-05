import { Star } from "lucide-react"

interface Review {
  id: string
  name: string
  text: string
  rating: number
  date: string | null
  createdAt: Date
}

const avatarColors = [
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-rose-100 text-rose-700",
  "bg-orange-100 text-orange-700",
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function ReviewsList({ reviews }: { reviews: Review[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {reviews.map((review, i) => (
        <div key={review.id} className="bg-white border border-border/60 rounded-2xl p-5 hover:shadow-sm transition-shadow">
          <div className="flex items-start gap-3 mb-3">
            {/* Avatar */}
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${avatarColors[i % avatarColors.length]}`}>
              {getInitials(review.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-sm text-foreground truncate">{review.name}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {review.date ?? new Date(review.createdAt).toLocaleDateString("ru-RU")}
                </span>
              </div>
              <div className="flex mt-0.5">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star
                    key={j}
                    className={j < review.rating ? "w-3.5 h-3.5 fill-amber-400 text-amber-400" : "w-3.5 h-3.5 text-muted-foreground/20"}
                  />
                ))}
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{review.text}</p>
        </div>
      ))}
    </div>
  )
}
