import { getWholesaleContext } from "@/lib/wholesale-guard"
import { getWeightTiers } from "@/lib/dal/pricing"

/**
 * Баннер-подсказка над каталогом: показывает весовые тиры прайс-листа.
 * Client-component'ы корзины показывают динамическую прогрессию.
 */
export async function TierInfoBanner() {
  const ctx = await getWholesaleContext()
  if (!ctx || !ctx.company.priceListId) return null
  const tiers = await getWeightTiers(ctx.company.priceListId)
  if (tiers.length === 0) return null

  return (
    <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 sm:p-4 mb-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground font-medium shrink-0 pt-0.5">
          Скидка по весу:
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {tiers.map((t) => (
            <span
              key={t.minWeightGrams}
              className="inline-flex items-center gap-1 rounded-full bg-white border border-primary/20 px-2.5 py-1"
            >
              <span className="text-muted-foreground">от</span>
              <span className="font-semibold">{(t.minWeightGrams / 1000).toFixed(0)} кг</span>
              <span className="text-primary font-semibold">−{t.discountPct}%</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
