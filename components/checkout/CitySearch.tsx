"use client"

import { useState, useEffect, useRef } from "react"
import { useDeliveryStore } from "@/lib/store/delivery"
import { useCartStore } from "@/lib/store/cart"

interface CityResult {
  code: string
  city: string
  region: string
  postalCodes?: string[]
}

export function CitySearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CityResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
  const abortRef = useRef<AbortController>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const city = useDeliveryStore((s) => s.city)
  const cityCode = useDeliveryStore((s) => s.cityCode)
  const postalCode = useDeliveryStore((s) => s.postalCode)
  const setCity = useDeliveryStore((s) => s.setCity)
  const setPostalCode = useDeliveryStore((s) => s.setPostalCode)
  const setRates = useDeliveryStore((s) => s.setRates)
  const setRatesLoading = useDeliveryStore((s) => s.setRatesLoading)
  const setRatesError = useDeliveryStore((s) => s.setRatesError)
  const selectRate = useDeliveryStore((s) => s.selectRate)

  const cartTotal = useCartStore((s) => s.totalPrice)()

  // Fetch rates when city changes
  useEffect(() => {
    if (!cityCode && !postalCode) return

    setRatesLoading(true)
    fetch("/api/delivery/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cityCode: cityCode || undefined,
        postalCode: postalCode || undefined,
        city: city || undefined,
        cartTotal,
      }),
    })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((rates) => {
        setRates(rates)
        setRatesLoading(false)
        // Auto-select cheapest if available
        if (rates.length > 0) {
          selectRate(rates[0])
        }
      })
      .catch(() => {
        setRatesError("Не удалось рассчитать стоимость доставки")
        setRatesLoading(false)
      })
    // city is intentionally excluded — cityCode is the unique identifier;
    // city name is sent in the body but shouldn't trigger re-fetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityCode, postalCode, cartTotal])

  // Debounced city search
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      try {
        const res = await fetch(`/api/delivery/cities?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          setOpen(true)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 300)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleSelect(c: CityResult) {
    setCity(c.city, c.code)
    if (c.postalCodes?.[0]) {
      setPostalCode(c.postalCodes[0])
    }
    setQuery(c.city)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium mb-1">Город доставки *</label>
      <input
        type="text"
        value={city ? (query || city) : query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (city) {
            setCity("", "")
            setPostalCode("")
          }
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        placeholder="Начните вводить название города..."
      />
      {loading && (
        <div className="absolute right-3 top-9 text-xs text-muted-foreground">...</div>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {results.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => handleSelect(c)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <span className="font-medium">{c.city}</span>
              <span className="text-muted-foreground ml-2">{c.region}</span>
            </button>
          ))}
        </div>
      )}

      {city && (
        <div className="mt-2">
          <label className="block text-sm font-medium mb-1">Почтовый индекс</label>
          <input
            type="text"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
            className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Для расчёта Почты России"
          />
        </div>
      )}
    </div>
  )
}
