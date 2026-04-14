import { Star, Users, Truck, ShieldCheck } from "lucide-react"

interface SocialProofStripProps {
  rating?: number
  reviewsCount?: number
  ordersShipped?: number
}

export function SocialProofStrip({
  rating = 4.9,
  reviewsCount = 2480,
  ordersShipped = 12400,
}: SocialProofStripProps) {
  const items = [
    {
      icon: <Star className="w-5 h-5 fill-amber-400 text-amber-400" strokeWidth={1.75} />,
      label: `${rating.toFixed(1)}`,
      sublabel: `${reviewsCount.toLocaleString("ru-RU")} отзывов`,
    },
    {
      icon: <Users className="w-5 h-5 text-primary" strokeWidth={1.75} />,
      label: `${ordersShipped.toLocaleString("ru-RU")}+`,
      sublabel: "довольных клиентов",
    },
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
          <ul className="flex items-center justify-start lg:justify-between gap-6 sm:gap-8 lg:gap-10 px-4 sm:px-0 py-4 sm:py-5 whitespace-nowrap">
            {items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 shrink-0">
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
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
