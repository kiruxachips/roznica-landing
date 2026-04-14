import { Flame, Truck } from "lucide-react"
import { getFreshnessInfo } from "@/lib/freshness"

export function FreshnessBadge() {
  const { lastRoastLabel, nextShipmentLabel } = getFreshnessInfo()

  return (
    <section aria-label="Информация о свежести" className="bg-primary/5 border-b border-primary/10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-6 py-2.5 sm:py-3 text-center">
          <div className="flex items-center gap-2 text-[13px] sm:text-sm">
            <Flame className="w-4 h-4 text-primary shrink-0" strokeWidth={1.75} />
            <span className="text-muted-foreground">
              Последняя обжарка:{" "}
              <span className="font-semibold text-foreground">{lastRoastLabel}</span>
            </span>
          </div>
          <span className="hidden sm:inline text-primary/30">·</span>
          <div className="flex items-center gap-2 text-[13px] sm:text-sm">
            <Truck className="w-4 h-4 text-primary shrink-0" strokeWidth={1.75} />
            <span className="text-muted-foreground">
              Ближайшая отправка:{" "}
              <span className="font-semibold text-foreground">{nextShipmentLabel}</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
