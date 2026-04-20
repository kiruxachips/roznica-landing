import Link from "next/link"
import { Star, Coffee, Truck, ShieldCheck } from "lucide-react"
import { getShopStats } from "@/lib/dal/stats"

type Accent = "amber" | "primary"

interface Item {
  accent: Accent
  icon: React.ReactNode
  primary: string
  secondary: string
  href?: string
}

export async function SocialProofStrip() {
  const { reviewsCount, averageRating, activeProductsCount } = await getShopStats()

  const hasRealRating = averageRating !== null && reviewsCount >= 3

  const ratingPrimary = hasRealRating ? averageRating!.toFixed(1).replace(".", ",") : "5,0"
  const ratingSecondary = hasRealRating
    ? `из 5 · ${reviewsCount} ${reviewsCount === 1 ? "отзыв" : reviewsCount < 5 ? "отзыва" : "отзывов"}`
    : "средняя оценка клиентов"

  const items: Item[] = [
    {
      accent: "amber",
      icon: <Star className="w-6 h-6 sm:w-7 sm:h-7 fill-amber-400 text-amber-400" strokeWidth={1.5} />,
      primary: ratingPrimary,
      secondary: ratingSecondary,
      href: "#testimonials",
    },
    {
      accent: "primary",
      icon: <Coffee className="w-6 h-6 sm:w-7 sm:h-7 text-primary" strokeWidth={1.5} />,
      primary: activeProductsCount > 0 ? `${activeProductsCount}` : "Свежая",
      secondary: activeProductsCount > 0 ? "сортов моноарабики" : "обжарка под заказ",
    },
    {
      accent: "primary",
      icon: <Truck className="w-6 h-6 sm:w-7 sm:h-7 text-primary" strokeWidth={1.5} />,
      primary: "2–3 дня",
      secondary: "СДЭК · Почта · курьер",
    },
    {
      accent: "primary",
      icon: <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-primary" strokeWidth={1.5} />,
      primary: "ЮKassa",
      secondary: "карты · СБП · ЮMoney",
    },
  ]

  return (
    <section
      aria-label="Показатели доверия"
      className="bg-gradient-to-b from-white to-secondary/20 border-y border-border/60"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ul className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x divide-border/50 -mx-4 sm:mx-0">
          {items.map((item, i) => {
            const inner = (
              <div className="flex items-center gap-3 sm:gap-4 py-5 sm:py-7 px-4 sm:px-6 lg:px-8 min-w-0">
                <span
                  className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    item.accent === "amber" ? "bg-amber-50" : "bg-primary/10"
                  }`}
                >
                  {item.icon}
                </span>
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="font-sans font-bold text-xl sm:text-2xl lg:text-3xl text-foreground truncate">
                    {item.primary}
                  </span>
                  <span className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">
                    {item.secondary}
                  </span>
                </div>
              </div>
            )

            return (
              <li
                key={i}
                className={`relative ${i % 2 === 1 ? "" : "border-r lg:border-r-0"} ${i < 2 ? "border-b lg:border-b-0" : ""} border-border/50`}
              >
                {item.href ? (
                  <Link
                    href={item.href}
                    className="block hover:bg-white/50 transition-colors"
                  >
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
