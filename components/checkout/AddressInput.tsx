"use client"

import { useState, useEffect, useRef } from "react"
import { MapPin } from "lucide-react"
import { useDeliveryStore } from "@/lib/store/delivery"

interface Suggestion {
  value: string
  postalCode: string
  lat?: number | null
  lng?: number | null
}

export function AddressInput() {
  const city = useDeliveryStore((s) => s.city)
  const doorAddress = useDeliveryStore((s) => s.doorAddress)
  const setDoorAddress = useDeliveryStore((s) => s.setDoorAddress)
  const setPostalCode = useDeliveryStore((s) => s.setPostalCode)

  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [queriedOnce, setQueriedOnce] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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

  function handleChange(value: string) {
    setDoorAddress(value)

    if (value.length < 2 || !city) {
      setSuggestions([])
      setOpen(false)
      return
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `/api/delivery/address-suggest?${new URLSearchParams({
            q: value,
            city,
          })}`
        )
        if (res.ok) {
          const data: Suggestion[] = await res.json()
          setSuggestions(data)
          setOpen(true)
          setQueriedOnce(true)
        }
      } catch {
        // Ignore
      } finally {
        setLoading(false)
      }
    }, 250)
  }

  function handleSelect(s: Suggestion) {
    setDoorAddress(s.value)
    if (s.postalCode) setPostalCode(s.postalCode)
    setOpen(false)
    setSuggestions([])
  }

  if (!city) return null

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium mb-1">Адрес *</label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={doorAddress}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          className="w-full h-11 pl-9 pr-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={`${city}, улица, дом, квартира`}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">...</div>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <span>{s.value}</span>
            </button>
          ))}
        </div>
      )}

      {open && !loading && queriedOnce && suggestions.length === 0 && doorAddress.length >= 2 && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Подсказки недоступны — введите адрес вручную
        </p>
      )}
    </div>
  )
}
