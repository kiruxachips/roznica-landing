"use client"

import { useDeliveryStore } from "@/lib/store/delivery"

export function DeliveryOptions() {
  const rates = useDeliveryStore((s) => s.rates)
  const ratesLoading = useDeliveryStore((s) => s.ratesLoading)
  const ratesError = useDeliveryStore((s) => s.ratesError)
  const selectedRate = useDeliveryStore((s) => s.selectedRate)
  const selectRate = useDeliveryStore((s) => s.selectRate)
  const city = useDeliveryStore((s) => s.city)

  if (!city) return null

  if (ratesLoading) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Рассчитываем стоимость доставки...
      </div>
    )
  }

  if (ratesError) {
    const friendlyError = ratesError.toLowerCase().includes("fetch") || ratesError.toLowerCase().includes("network")
      ? "Не удалось связаться со службой доставки. Попробуйте позже"
      : ratesError
    return (
      <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{friendlyError}</p>
    )
  }

  if (rates.length === 0) return null

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium mb-1">Способ доставки</label>
      {rates.map((rate, i) => {
        const isSelected =
          selectedRate?.carrier === rate.carrier &&
          selectedRate?.tariffCode === rate.tariffCode
        return (
          <label
            key={`${rate.carrier}-${rate.tariffCode}-${i}`}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
              isSelected
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/30"
            }`}
          >
            <input
              type="radio"
              name="deliveryRate"
              checked={isSelected}
              onChange={() => selectRate(rate)}
              className="accent-primary"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{rate.tariffName}</p>
              <p className="text-xs text-muted-foreground">
                {rate.minDays === rate.maxDays
                  ? `${rate.minDays} дн.`
                  : `${rate.minDays}-${rate.maxDays} дн.`}
                {rate.deliveryType === "pvz" && " · до пункта выдачи"}
                {rate.deliveryType === "door" && " · до двери"}
              </p>
            </div>
            <span className="text-sm font-semibold whitespace-nowrap">
              {rate.priceWithMarkup === 0 ? "Бесплатно" : `${rate.priceWithMarkup}₽`}
            </span>
          </label>
        )
      })}
    </div>
  )
}
