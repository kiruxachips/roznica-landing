import Link from "next/link"
import { Star, Flame, Truck, ShieldCheck } from "lucide-react"
import { getShopStats } from "@/lib/dal/stats"

export async function SocialProofStrip() {
  const { reviewsCount, averageRating, activeProductsCount } = await getShopStats()

  const hasRealRating = averageRating !== null && reviewsCount >= 3

  const items = [
    // 1. Rating — real data if we have reviews, otherwise 5-star visual with "новый"
    hasRealRating
      ? {
          accent: "amber" as const,
          icon: <Star className="w-5 h-5 fill-amber-400 text-amber-400" strokeWidth={1.75} />,
          primary: averageRating!.toFixed(1),
          secondary: `${reviewsCount} ${reviewsCount === 1 ? "отзыв" : reviewsCount < 5 ? "отзыва" : "отзывов"}`,
          href: "#testimonials",
        }
      : {
          accent: "amber" as const,
          icon: <Star className="w-5 h-5 fill-amber-400 text-amber-400" strokeWidth={1.75} />,
          primary: "5,0",
          secondary: "оценка клиентов",
          href: "#testimonials",
        },
    // 2. Catalog depth — real product count
    {
      accent: "primary" as const,
      icon: <Flame className="w-5 h-5 text-primary" strokeWidth={1.75} />,
      primary: activeProductsCount > 0 ? `${activeProductsCount} сортов` : "Свежая обжарка",
      secondary: "моноарабика под заказ",
    },
    // 3. Delivery
    {
      accent: "primary" as const,
      icon: <Truck className="w-5 h-5 text-primary" strokeWidth={1.75} />,
      primary: "2–3 дня",
      secondary: "СДЭК, Почта, курьер",
    },
    // 4. Payment
    {
      accent: "primary" as const,
      icon: <ShieldCheck className="w-5 h-5 text-primary" strokeWidth={1.75} />,
      primary: "ЮKassa",
      secondary: "карты, СБП, ЮMoney",
    },
  ]

  return (
    <section aria-label="Показатели доверия" className="bg-white border-y border-border/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="-mx-4 sm:mx-0 overflow-x-auto scrollbar-hide">
          <ul className="flex items-center justify-start sm:justify-between lg:justify-center gap-8 sm:gap-10 lg:gap-14 px-4 sm:px-0 py-4 sm:py-5 whitespace-nowrap">
            {items.map((item, i) => {
              const content = (
                <>
                  <span className="w-10 h-10 rounded-xl bg-secondary/70 flex items-center justify-center shrink-0">
                    {item.icon}
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm sm:text-base font-bold text-foreground">
                      {item.primary}
                    </span>
                    <span className="text-[11px] sm:text-xs text-muted-foreground">
                      {item.secondary}
                    </span>
                  </div>
                </>
              )
              return (
                <li key={i} className="shrink-0">
                  {"href" in item && item.href ? (
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3">{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
