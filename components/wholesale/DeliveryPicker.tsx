"use client"

import { useEffect, useState } from "react"

export interface DeliveryRate {
  carrier: "cdek" | "pochta" | "courier"
  tariffCode: number
  tariffName: string
  type: "pvz" | "door"
  priceWithMarkup: number
  estimatedDays?: string
}

export interface DeliveryPickerValue {
  city: string
  postalCode: string
  selected: DeliveryRate | null
}

interface CityOption {
  code: number
  city: string
  region: string
  postalCode?: string
}

interface Props {
  items: { weightGrams: number; quantity: number }[]
  cartTotal: number
  onChange: (value: DeliveryPickerValue) => void
}

/**
 * Упрощённый калькулятор доставки для оптового checkout:
 * автокомплит города через DaData-совместимый API сайта → расчёт тарифов
 * через /api/delivery/rates → выбор тарифа.
 *
 * Не дублирует логику розницы (CitySearch+DeliveryOptions+store) — здесь
 * корзина другая и нет тех же bonus/promo-сайд эффектов. Делаем прямые
 * fetch'и.
 */
export function WholesaleDeliveryPicker({ items, cartTotal, onChange }: Props) {
  const [cityQuery, setCityQuery] = useState("")
  const [cities, setCities] = useState<CityOption[]>([])
  const [selectedCity, setSelectedCity] = useState<CityOption | null>(null)
  const [postalCode, setPostalCode] = useState("")
  const [rates, setRates] = useState<DeliveryRate[]>([])
  const [selectedRate, setSelectedRate] = useState<DeliveryRate | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Debounced city suggest
  useEffect(() => {
    if (!cityQuery || cityQuery.length < 2) {
      setCities([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/delivery/cities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: cityQuery }),
        })
        if (!res.ok) return
        const data = (await res.json()) as CityOption[]
        setCities(data.slice(0, 8))
      } catch {}
    }, 300)
    return () => clearTimeout(timer)
  }, [cityQuery])

  // Fetch rates when city/postal + items change
  useEffect(() => {
    if (!selectedCity?.code && !postalCode) return
    setLoading(true)
    setError("")
    fetch("/api/delivery/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cityCode: selectedCity?.code,
        postalCode: postalCode || selectedCity?.postalCode,
        city: selectedCity?.city,
        region: selectedCity?.region,
        cartTotal,
        items,
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list: DeliveryRate[]) => {
        setRates(list)
        // Сохраняем текущий выбор, если возможно
        const keep =
          selectedRate &&
          list.find(
            (r) => r.carrier === selectedRate.carrier && r.tariffCode === selectedRate.tariffCode
          )
        const pick = keep || list[0] || null
        setSelectedRate(pick)
      })
      .catch(() => setError("Не удалось рассчитать доставку"))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity?.code, postalCode, cartTotal, items.length])

  // Report up
  useEffect(() => {
    onChange({
      city: selectedCity?.city || cityQuery,
      postalCode: postalCode || selectedCity?.postalCode || "",
      selected: selectedRate,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity, postalCode, selectedRate])

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-[1fr_140px] gap-3">
        <div className="relative">
          <label className="text-sm font-medium mb-1.5 block">Город</label>
          <input
            value={cityQuery}
            onChange={(e) => {
              setCityQuery(e.target.value)
              setSelectedCity(null)
            }}
            placeholder="Москва"
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm"
          />
          {cities.length > 0 && !selectedCity && (
            <ul className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-border max-h-60 overflow-y-auto">
              {cities.map((c) => (
                <li
                  key={`${c.code}-${c.city}`}
                  onMouseDown={() => {
                    setSelectedCity(c)
                    setCityQuery(c.city)
                    setCities([])
                  }}
                  className="px-4 py-2 text-sm cursor-pointer hover:bg-muted"
                >
                  <div className="font-medium">{c.city}</div>
                  <div className="text-xs text-muted-foreground">{c.region}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Индекс</label>
          <input
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            placeholder="119121"
            inputMode="numeric"
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {loading && <div className="text-sm text-muted-foreground">Рассчитываем тарифы...</div>}

      {rates.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium block">Тариф</label>
          {rates.map((r) => {
            const active =
              selectedRate?.carrier === r.carrier && selectedRate?.tariffCode === r.tariffCode
            return (
              <label
                key={`${r.carrier}-${r.tariffCode}`}
                className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer ${
                  active ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div>
                  <div className="font-medium text-sm">
                    {r.carrier.toUpperCase()} · {r.tariffName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.type === "pvz" ? "Пункт выдачи" : "Курьером"}
                    {r.estimatedDays ? ` · ${r.estimatedDays}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">
                    {r.priceWithMarkup.toLocaleString("ru")}₽
                  </span>
                  <input
                    type="radio"
                    name="wh-delivery-rate"
                    checked={active}
                    onChange={() => setSelectedRate(r)}
                  />
                </div>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
