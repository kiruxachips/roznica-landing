"use client"

import { useState, useMemo } from "react"
import { Truck, Package, Clock, ChevronDown } from "lucide-react"
import { useDeliveryStore } from "@/lib/store/delivery"

interface CarrierInfo {
  id: string
  name: string
  icon: React.ReactNode
  badge: string | null
  badgeClass: string
}

// DPD скрыт до реализации интеграции (P1-3). Статическое обещание
// "Бесплатно от 3000₽" для Почты убрано (P1-1) — это правда только
// для близких регионов с тарифом Почты ≤ 750₽; для дальних порог 5-10k.
// Реальная цена видна ниже в секции тарифов — там она точная.
const CARRIERS: CarrierInfo[] = [
  {
    id: "cdek",
    name: "СДЭК",
    icon: <Truck className="w-5 h-5" />,
    badge: "Самый быстрый",
    badgeClass: "bg-blue-50 text-blue-700",
  },
  {
    id: "pochta",
    name: "Почта России",
    icon: <Package className="w-5 h-5" />,
    badge: null,
    badgeClass: "",
  },
]

export function DeliveryOptions() {
  const rates = useDeliveryStore((s) => s.rates)
  const ratesLoading = useDeliveryStore((s) => s.ratesLoading)
  const ratesError = useDeliveryStore((s) => s.ratesError)
  const selectedRate = useDeliveryStore((s) => s.selectedRate)
  const selectRate = useDeliveryStore((s) => s.selectRate)
  const city = useDeliveryStore((s) => s.city)

  const [expandedCarrier, setExpandedCarrier] = useState<string | null>(null)

  // Group rates by carrier
  const grouped = useMemo(() => {
    const map: Record<string, typeof rates> = {}
    for (const rate of rates) {
      if (!map[rate.carrier]) map[rate.carrier] = []
      map[rate.carrier].push(rate)
    }
    return map
  }, [rates])

  if (!city) return null

  if (ratesLoading) {
    return (
      <div className="space-y-3">
        <label className="block text-sm font-medium">Служба доставки</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-border bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (ratesError) {
    return (
      <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">
        {ratesError.toLowerCase().includes("fetch")
          ? "Не удалось связаться со службой доставки. Попробуйте позже"
          : ratesError}
      </p>
    )
  }

  if (rates.length === 0) return null

  function handleCarrierClick(carrierId: string) {
    const carrierRates = grouped[carrierId]
    if (!carrierRates || carrierRates.length === 0) return

    if (expandedCarrier === carrierId) {
      setExpandedCarrier(null)
      return
    }

    setExpandedCarrier(carrierId)

    // Auto-select the first (cheapest) rate if none from this carrier is selected
    if (!selectedRate || selectedRate.carrier !== carrierId) {
      selectRate(carrierRates[0])
    }
  }

  function handleTariffSelect(rate: typeof rates[number]) {
    selectRate(rate)
  }

  // Courier rates (separate section for Kaliningrad)
  const courierRates = grouped["courier"]
  const hasActiveCourier = courierRates && courierRates.length > 0

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">Служба доставки</label>

      {/* Local courier — shown only for Kaliningrad */}
      {hasActiveCourier && (
        <div className="space-y-2">
          {courierRates.map((rate) => {
            const isSelected = selectedRate?.carrier === "courier" && selectedRate?.tariffCode === rate.tariffCode
            return (
              <label
                key="courier"
                className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30"
                }`}
              >
                <input
                  type="radio"
                  name="deliveryCarrier"
                  checked={isSelected}
                  onChange={() => {
                    selectRate(rate)
                    setExpandedCarrier(null)
                  }}
                  className="accent-primary"
                />
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">{rate.tariffName}</p>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
                      Локальная
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {rate.minDays}-{rate.maxDays} дн. · до двери
                  </p>
                </div>
                <span className="text-sm font-semibold whitespace-nowrap">
                  {rate.priceWithMarkup === 0 ? "Бесплатно" : `${rate.priceWithMarkup}₽`}
                </span>
              </label>
            )
          })}
        </div>
      )}

      {/* Carrier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CARRIERS.map((carrier) => {
          const carrierRates = grouped[carrier.id]
          const isAvailable = carrierRates && carrierRates.length > 0
          const isExpanded = expandedCarrier === carrier.id
          const isActiveCarrier = selectedRate?.carrier === carrier.id

          // Price summary
          const minPrice = isAvailable
            ? Math.min(...carrierRates.map((r) => r.priceWithMarkup))
            : 0
          const hasFree = isAvailable && carrierRates.some((r) => r.priceWithMarkup === 0)

          // Days summary
          const minDays = isAvailable
            ? Math.min(...carrierRates.map((r) => r.minDays))
            : 0
          const maxDays = isAvailable
            ? Math.max(...carrierRates.map((r) => r.maxDays))
            : 0

          return (
            <div key={carrier.id} className="flex flex-col">
              <button
                type="button"
                disabled={!isAvailable}
                onClick={() => handleCarrierClick(carrier.id)}
                className={`relative flex flex-col items-center text-center p-4 rounded-xl border-2 transition-all h-full ${
                  !isAvailable
                    ? "border-border opacity-50 cursor-not-allowed"
                    : isActiveCarrier
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:shadow-sm cursor-pointer"
                }`}
              >
                {/* Icon */}
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg mb-2 ${
                  isActiveCarrier ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {carrier.icon}
                </div>

                {/* Name */}
                <p className={`font-semibold text-sm ${isActiveCarrier ? "text-primary" : ""}`}>
                  {carrier.name}
                </p>

                {/* Badge */}
                {carrier.badge && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium mt-1.5 ${carrier.badgeClass}`}>
                    {carrier.badge}
                  </span>
                )}

                {/* Price & days summary */}
                {isAvailable && (
                  <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                    <p className="font-medium text-foreground">
                      {hasFree ? "Бесплатно" : `от ${minPrice}₽`}
                    </p>
                    <p className="flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3" />
                      {minDays === maxDays ? `${minDays} дн.` : `${minDays}-${maxDays} дн.`}
                    </p>
                  </div>
                )}

                {/* Unavailable message */}
                {!isAvailable && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Нет доставки в этот город
                  </p>
                )}

                {/* Expand indicator */}
                {isAvailable && (
                  <ChevronDown className={`w-4 h-4 mt-2 text-muted-foreground transition-transform ${
                    isExpanded ? "rotate-180" : ""
                  }`} />
                )}
              </button>

              {/* Expanded tariff options */}
              {isExpanded && isAvailable && (
                <div className="mt-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
                  {carrierRates.map((rate, i) => {
                    const isSelected =
                      selectedRate?.carrier === rate.carrier &&
                      selectedRate?.tariffCode === rate.tariffCode
                    return (
                      <label
                        key={`${rate.carrier}-${rate.tariffCode}-${i}`}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors text-left ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="deliveryTariff"
                          checked={isSelected}
                          onChange={() => handleTariffSelect(rate)}
                          className="accent-primary shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {rate.deliveryType === "pvz" ? "Забрать из пункта выдачи" : "Доставка до двери"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {rate.minDays === rate.maxDays
                              ? `${rate.minDays} дн.`
                              : `${rate.minDays}-${rate.maxDays} дн.`}
                          </p>
                        </div>
                        <span className="text-sm font-semibold whitespace-nowrap">
                          {rate.priceWithMarkup === 0 ? "Бесплатно" : `${rate.priceWithMarkup}₽`}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
