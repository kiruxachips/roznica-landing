import Link from "next/link"
import { Star, Users, Truck, ShieldCheck } from "lucide-react"
import { getShopStats } from "@/lib/dal/stats"

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k+`
  if (n >= 100) return `${Math.floor(n / 10) * 10}+`
  return `${n}`
}

export async function SocialProofStrip() {
  const { reviewsCount, averageRating, ordersCount } = await getShopStats()

  const ratingItem =
    averageRating !== null && reviewsCount >= 3
      ? {
          icon: <Star className="w-5 h-5 fill-amber-400 text-amber-400" strokeWidth={1.75} />,
          label: averageRating.toFixed(1),
          sublabel: `${reviewsCount} ${reviewsCount === 1 ? "отзыв" : reviewsCount < 5 ? "отзыва" : "отзывов"}`,
          href: "#testimonials",
        }
      : {
          icon: <Star className="w-5 h-5 fill-amber-400 text-amber-400" strokeWidth={1.75} />,
          label: "Отзывы",
          sublabel: "реальных клиентов",
          href: "#testimonials",
        }

  const ordersItem =
    ordersCount >= 10
      ? {
          icon: <Users className="w-5 h-5 text-primary" strokeWidth={1.75} />,
          label: formatCount(ordersCount),
          sublabel: "заказов доставлено",
        }
      : {
          icon: <Users className="w-5 h-5 text-primary" strokeWidth={1.75} />,
          label: "Живые заказы",
          sublabel: "каждый день",
        }

  const items = [
    ratingItem,
    ordersItem,
    {
      icon: <Truck className="w-5 h-5 text-primary" strokeWidth={1.75} />,
      label: "СДЭК · Почта · Курьер",
      sublabel: "доставка по России",
    },
    {
      icon: <ShieldCheck className="w-5 h-5 text-primary" strokeWidth={1.75} />,
      label: "ЮKassa",
      sublabel: "безопасная оплата",
    },
  ]

  return (
    <section aria-label="Показатели доверия" className="bg-white border-y border-border/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="-mx-4 sm:mx-0 overflow-x-auto scrollbar-hide">
          <ul className="flex items-center justify-start lg:justify-center gap-6 sm:gap-10 lg:gap-14 px-4 sm:px-0 py-4 sm:py-5 whitespace-nowrap">
            {items.map((item, i) => {
              const content = (
                <>
                  <span className="w-10 h-10 rounded-xl bg-secondary/70 flex items-center justify-center shrink-0">
                    {item.icon}
                  </span>
                  <div className="flex flex-col leading-tight">
                    <span className="text-sm sm:text-base font-semibold text-foreground">
                      {item.label}
                    </span>
                    <span className="text-[11px] sm:text-xs text-muted-foreground">
                      {item.sublabel}
                    </span>
                  </div>
                </>
              )
              return (
                <li key={i} className="shrink-0">
                  {"href" in item && item.href ? (
                    <Link href={item.href} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
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
