"use client"

import { useState } from "react"
import { Plus, Trash2, Package } from "lucide-react"
import { testCalculateDelivery } from "@/lib/actions/delivery"

interface CityResult {
  code: string
  city: string
  region: string
  postalCodes?: string[]
}

interface Rate {
  carrier: "cdek" | "pochta" | "courier"
  carrierName: string
  tariffCode: number
  tariffName: string
  deliveryType: "door" | "pvz"
  price: number
  priceWithMarkup: number
  minDays: number
  maxDays: number
}

interface PlanPackage {
  length: number
  width: number
  height: number
  weight: number
  presetCode?: string
}

type PackRow = { weightGrams: string; quantity: string }

export function DeliveryCalculatorTester() {
  const [cityQuery, setCityQuery] = useState("")
  const [cityResults, setCityResults] = useState<CityResult[]>([])
  const [selectedCity, setSelectedCity] = useState<CityResult | null>(null)
  const [cartTotal, setCartTotal] = useState("3000")
  const [rows, setRows] = useState<PackRow[]>([
    { weightGrams: "250", quantity: "2" },
    { weightGrams: "1000", quantity: "2" },
  ])
  const [loading, setLoading] = useState(false)
  const [cityLoading, setCityLoading] = useState(false)
  const [result, setResult] = useState<{ rates: Rate[]; plan: PlanPackage[] } | null>(null)
  const [error, setError] = useState("")

  async function searchCity(q: string) {
    setCityQuery(q)
    if (q.length < 2) {
      setCityResults([])
      return
    }
    setCityLoading(true)
    try {
      const res = await fetch(`/api/delivery/cities?q=${encodeURIComponent(q)}`)
      if (res.ok) setCityResults(await res.json())
    } finally {
      setCityLoading(false)
    }
  }

  function selectCity(c: CityResult) {
    setSelectedCity(c)
    setCityQuery(c.city)
    setCityResults([])
  }

  function addRow() {
    setRows([...rows, { weightGrams: "250", quantity: "1" }])
  }
  function removeRow(i: number) {
    setRows(rows.filter((_, idx) => idx !== i))
  }
  function updateRow(i: number, field: "weightGrams" | "quantity", v: string) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [field]: v } : r)))
  }

  async function runCalculation() {
    if (!selectedCity) {
      setError("Выберите город")
      return
    }
    const items = rows
      .map((r) => ({
        weightGrams: parseInt(r.weightGrams) || 0,
        quantity: parseInt(r.quantity) || 0,
      }))
      .filter((i) => i.weightGrams > 0 && i.quantity > 0)
    if (items.length === 0) {
      setError("Добавьте хотя бы одну пачку")
      return
    }
    setError("")
    setLoading(true)
    setResult(null)
    try {
      const res = await testCalculateDelivery({
        cityCode: selectedCity.code,
        postalCode: selectedCity.postalCodes?.[0],
        city: selectedCity.city,
        region: selectedCity.region,
        items,
        cartTotal: parseInt(cartTotal) || 0,
      })
      if (res.success) {
        setResult({ rates: res.rates as Rate[], plan: res.plan as PlanPackage[] })
      } else {
        setError(res.error || "Ошибка")
      }
    } finally {
      setLoading(false)
    }
  }

  const labelClass = "block text-sm font-medium mb-1"
  const inputClass =
    "w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Тестовый расчёт</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Вбейте город и состав корзины — увидите, что увидит покупатель.
          Полезно для сверки с официальным калькулятором перевозчика и отладки наценок.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative">
          <label className={labelClass}>Город назначения</label>
          <input
            value={cityQuery}
            onChange={(e) => {
              searchCity(e.target.value)
              if (selectedCity) setSelectedCity(null)
            }}
            placeholder="Начните вводить..."
            className={inputClass}
          />
          {cityLoading && <div className="absolute right-3 top-9 text-xs text-muted-foreground">...</div>}
          {cityResults.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
              {cityResults.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => selectCity(c)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-muted"
                >
                  <span className="font-medium">{c.city}</span>
                  <span className="text-muted-foreground ml-2">{c.region}</span>
                </button>
              ))}
            </div>
          )}
          {selectedCity && (
            <p className="text-xs text-muted-foreground mt-1">
              CDEK code: {selectedCity.code}
              {selectedCity.postalCodes?.[0] ? ` · индекс ${selectedCity.postalCodes[0]}` : ""}
            </p>
          )}
        </div>

        <div>
          <label className={labelClass}>Сумма корзины (₽) — для правил наценок</label>
          <input
            type="number"
            value={cartTotal}
            onChange={(e) => setCartTotal(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelClass}>Состав корзины</label>
          <button
            type="button"
            onClick={addRow}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Добавить
          </button>
        </div>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="number"
                value={row.weightGrams}
                onChange={(e) => updateRow(i, "weightGrams", e.target.value)}
                className="w-28 h-9 px-2 rounded border border-input text-sm"
                placeholder="вес (г)"
              />
              <span className="text-muted-foreground text-sm">г ×</span>
              <input
                type="number"
                value={row.quantity}
                onChange={(e) => updateRow(i, "quantity", e.target.value)}
                className="w-20 h-9 px-2 rounded border border-input text-sm"
                placeholder="шт"
              />
              <span className="text-muted-foreground text-sm">шт</span>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-red-500 hover:text-red-700 ml-auto"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={runCalculation}
        disabled={loading}
        className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Расчёт..." : "Рассчитать"}
      </button>

      {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

      {result && (
        <div className="space-y-4">
          <div>
            <h3 className="text-md font-semibold mb-2">План упаковки</h3>
            <div className="space-y-1.5">
              {result.plan.map((p, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 text-sm">
                  <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">
                    {p.presetCode ? `${p.presetCode} ` : ""}
                    {p.length}×{p.width}×{p.height} см
                  </span>
                  <span className="text-muted-foreground ml-auto tabular-nums">{p.weight} г</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Итого коробок: {result.plan.length} · суммарный брутто-вес:{" "}
                {result.plan.reduce((s, p) => s + p.weight, 0)} г
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-md font-semibold mb-2">Доступные тарифы</h3>
            {result.rates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Тарифы не получены. Проверьте настройки перевозчиков и креденшелы.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Перевозчик</th>
                      <th className="text-left px-3 py-2 font-medium">Тариф</th>
                      <th className="text-left px-3 py-2 font-medium">Тип</th>
                      <th className="text-right px-3 py-2 font-medium">Базовая цена</th>
                      <th className="text-right px-3 py-2 font-medium">С наценками</th>
                      <th className="text-right px-3 py-2 font-medium">Срок</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rates.map((r) => (
                      <tr key={`${r.carrier}-${r.tariffCode}`} className="border-t border-border">
                        <td className="px-3 py-2">{r.carrierName}</td>
                        <td className="px-3 py-2">
                          {r.tariffName}
                          <span className="ml-1 text-muted-foreground text-xs">({r.tariffCode})</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {r.deliveryType === "pvz" ? "ПВЗ" : "дверь"}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{r.price} ₽</td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums font-semibold ${
                            r.priceWithMarkup !== r.price ? "text-amber-700" : ""
                          }`}
                        >
                          {r.priceWithMarkup} ₽
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {r.minDays}-{r.maxDays} дн.
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
