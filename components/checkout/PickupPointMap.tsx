"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Search, X, MapPin } from "lucide-react"
import { useDeliveryStore } from "@/lib/store/delivery"

interface SuggestionDTO {
  value: string
  postalCode: string
  lat?: number | null
  lng?: number | null
}

// Haversine distance in kilometers
function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function PickupPointMap() {
  const city = useDeliveryStore((s) => s.city)
  const cityCode = useDeliveryStore((s) => s.cityCode)
  const selectedRate = useDeliveryStore((s) => s.selectedRate)
  const pickupPoints = useDeliveryStore((s) => s.pickupPoints)
  const pickupPointsLoading = useDeliveryStore((s) => s.pickupPointsLoading)
  const selectedPickupPoint = useDeliveryStore((s) => s.selectedPickupPoint)
  const setPickupPoints = useDeliveryStore((s) => s.setPickupPoints)
  const setPickupPointsLoading = useDeliveryStore((s) => s.setPickupPointsLoading)
  const selectPickupPoint = useDeliveryStore((s) => s.selectPickupPoint)

  const [apiKey, setApiKey] = useState("")
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<YMapInstance | null>(null)
  const markersRef = useRef<YMapMarkerInstance[]>([])
  const [listView, setListView] = useState(true)
  const [mapError, setMapError] = useState(false)

  // Address-based search
  const [searchQuery, setSearchQuery] = useState("")
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionDTO[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Load public settings (API key)
  useEffect(() => {
    fetch("/api/delivery/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data?.yandexMapsApiKey && setApiKey(data.yandexMapsApiKey))
      .catch(() => {})
  }, [])

  // Fetch pickup points
  useEffect(() => {
    if (!cityCode || selectedRate?.deliveryType !== "pvz") return

    setPickupPointsLoading(true)
    const params = new URLSearchParams({
      city_code: cityCode,
      carrier: selectedRate.carrier,
      ...(city ? { city } : {}),
    })
    fetch(`/api/delivery/pickup-points?${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then((points) => {
        setPickupPoints(points)
        setPickupPointsLoading(false)
      })
      .catch(() => setPickupPointsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityCode, selectedRate?.carrier, selectedRate?.deliveryType])

  // Reset search when city/carrier changes
  useEffect(() => {
    setSearchQuery("")
    setSearchCenter(null)
    setSuggestions([])
    setSuggestOpen(false)
  }, [cityCode, selectedRate?.carrier])

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSuggestOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Debounced suggestion fetch
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2 || !city) {
      setSuggestions([])
      return
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(async () => {
      setSuggestLoading(true)
      try {
        const res = await fetch(
          `/api/delivery/address-suggest?${new URLSearchParams({ q: searchQuery, city })}`
        )
        if (res.ok) {
          const data: SuggestionDTO[] = await res.json()
          setSuggestions(data)
          if (data.length > 0) setSuggestOpen(true)
        }
      } catch {
        // ignore
      } finally {
        setSuggestLoading(false)
      }
    }, 300)
  }, [searchQuery, city])

  // Filtered + sorted pickup points
  const visiblePoints = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let points = pickupPoints

    // Text filter: match in name or address
    if (q && !searchCenter) {
      points = points.filter(
        (p) =>
          p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
      )
    }

    // Distance sort: if user picked a suggestion, sort by distance
    if (searchCenter) {
      points = [...points]
        .map((p) => ({
          point: p,
          distance: distanceKm(searchCenter.lat, searchCenter.lng, p.lat, p.lng),
        }))
        .sort((a, b) => a.distance - b.distance)
        .map(({ point }) => point)
    }

    return points
  }, [pickupPoints, searchQuery, searchCenter])

  // Compute distances for display when searchCenter exists
  const distances = useMemo(() => {
    if (!searchCenter) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const p of pickupPoints) {
      map.set(
        p.code,
        distanceKm(searchCenter.lat, searchCenter.lng, p.lat, p.lng)
      )
    }
    return map
  }, [pickupPoints, searchCenter])

  // Load Yandex Maps script
  useEffect(() => {
    if (!apiKey || scriptLoaded) return
    if (document.querySelector("script[src*='api-maps.yandex.ru']")) {
      setScriptLoaded(true)
      return
    }

    const script = document.createElement("script")
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${apiKey}&lang=ru_RU`
    script.async = true
    script.onload = () => setScriptLoaded(true)
    script.onerror = () => setMapError(true)
    document.head.appendChild(script)

    const timeout = setTimeout(() => {
      if (!scriptLoaded) setMapError(true)
    }, 8000)
    return () => clearTimeout(timeout)
  }, [apiKey, scriptLoaded])

  // Init map with visible points
  const initMap = useCallback(async () => {
    if (!scriptLoaded || !mapRef.current || visiblePoints.length === 0) return
    if (!window.ymaps3) {
      setMapError(true)
      return
    }

    try {
      await window.ymaps3.ready

      // Destroy prev
      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy()
        mapInstanceRef.current = null
      }
      markersRef.current = []

      const focus = searchCenter || {
        lat: visiblePoints[0].lat,
        lng: visiblePoints[0].lng,
      }
      const center = [focus.lng, focus.lat]
      const map = new window.ymaps3.YMap(mapRef.current, {
        location: { center, zoom: searchCenter ? 14 : 12 },
      })

      map.addChild(new window.ymaps3.YMapDefaultSchemeLayer())
      map.addChild(new window.ymaps3.YMapDefaultFeaturesLayer())

      // Search center marker (red pin)
      if (searchCenter) {
        const el = document.createElement("div")
        el.style.cssText =
          "width:18px;height:18px;background:#dc2626;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"
        const marker = new window.ymaps3.YMapMarker({
          coordinates: [searchCenter.lng, searchCenter.lat],
        })
        marker.element.appendChild(el)
        map.addChild(marker)
      }

      // Add pickup markers (cap for performance)
      const capped = visiblePoints.slice(0, 120)
      for (const point of capped) {
        const el = document.createElement("div")
        el.className = "ymaps-marker"
        el.style.cssText =
          "width:24px;height:24px;background:#2d6b4a;border-radius:50%;border:2px solid white;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.3);"
        el.title = point.name

        const marker = new window.ymaps3.YMapMarker({
          coordinates: [point.lng, point.lat],
          onClick: () => selectPickupPoint(point),
        })
        marker.element.appendChild(el)
        map.addChild(marker)
        markersRef.current.push(marker)
      }

      mapInstanceRef.current = map
      setMapError(false)
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("Yandex Maps init error:", err)
      setMapError(true)
    }
  }, [scriptLoaded, visiblePoints, searchCenter, selectPickupPoint])

  useEffect(() => {
    if (!listView) initMap()
  }, [listView, initMap])

  function handleSuggestionSelect(s: SuggestionDTO) {
    setSearchQuery(s.value)
    if (s.lat != null && s.lng != null) {
      setSearchCenter({ lat: s.lat, lng: s.lng })
    }
    setSuggestOpen(false)
    setSuggestions([])
  }

  function clearSearch() {
    setSearchQuery("")
    setSearchCenter(null)
    setSuggestions([])
    setSuggestOpen(false)
  }

  if (selectedRate?.deliveryType !== "pvz") return null

  if (pickupPointsLoading) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Загружаем пункты выдачи...
      </div>
    )
  }

  if (pickupPoints.length === 0) {
    return <p className="text-sm text-muted-foreground">Нет пунктов выдачи в этом городе</p>
  }

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div ref={searchContainerRef} className="relative">
        <label className="block text-sm font-medium mb-1">Найти пункт выдачи</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSearchCenter(null)
            }}
            onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
            className="w-full h-11 pl-9 pr-10 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Улица и дом или название ПВЗ"
            autoComplete="off"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Очистить"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {suggestLoading && (
            <div className="absolute right-9 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              ...
            </div>
          )}
        </div>

        {suggestOpen && suggestions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-56 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSuggestionSelect(s)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors flex items-start gap-2 first:rounded-t-xl last:rounded-b-xl"
              >
                <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <span>{s.value}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Counter + toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {searchCenter
            ? `${visiblePoints.length} ПВЗ, отсортировано по расстоянию`
            : searchQuery
              ? `Найдено ${visiblePoints.length} из ${pickupPoints.length}`
              : `Всего ${pickupPoints.length} ПВЗ`}
        </span>
        <button
          type="button"
          onClick={() => setListView(!listView)}
          className="text-xs text-primary hover:underline px-3 py-1.5 rounded-lg border border-primary/20"
        >
          {listView ? "Карта" : "Список"}
        </button>
      </div>

      {selectedPickupPoint && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-sm">
          <p className="font-medium">{selectedPickupPoint.name}</p>
          <p className="text-muted-foreground">{selectedPickupPoint.address}</p>
          {selectedPickupPoint.workTime && (
            <p className="text-xs text-muted-foreground mt-1">{selectedPickupPoint.workTime}</p>
          )}
          {selectedPickupPoint.phone && (
            <p className="text-xs text-muted-foreground">{selectedPickupPoint.phone}</p>
          )}
        </div>
      )}

      {!listView && !mapError && apiKey ? (
        <div className="relative">
          <div
            ref={mapRef}
            className="w-full h-48 sm:h-64 md:h-80 rounded-xl overflow-hidden border border-border"
          />
          {scriptLoaded === false && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              Загружаем карту...
            </div>
          )}
        </div>
      ) : mapError && !listView ? (
        <div className="w-full h-32 rounded-xl border border-border flex items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Не удалось загрузить карту.{" "}
            <button
              type="button"
              onClick={() => setListView(true)}
              className="text-primary underline"
            >
              Показать список
            </button>
          </p>
        </div>
      ) : visiblePoints.length === 0 ? (
        <div className="border border-border rounded-xl p-4 text-sm text-muted-foreground">
          По запросу ничего не найдено.{" "}
          <button type="button" onClick={clearSearch} className="text-primary hover:underline">
            Сбросить поиск
          </button>
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto border border-border rounded-xl divide-y divide-border">
          {visiblePoints.slice(0, 60).map((point) => {
            const dist = distances.get(point.code)
            const isSelected = selectedPickupPoint?.code === point.code
            return (
              <button
                key={point.code}
                type="button"
                onClick={() => selectPickupPoint(point)}
                className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                  isSelected ? "bg-primary/5" : "hover:bg-muted"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{point.name}</p>
                    <p className="text-xs text-muted-foreground">{point.address}</p>
                    {point.workTime && (
                      <p className="text-xs text-muted-foreground">{point.workTime}</p>
                    )}
                  </div>
                  {dist != null && (
                    <span className="shrink-0 text-xs text-primary font-medium bg-primary/5 px-2 py-0.5 rounded-full">
                      {dist < 1 ? `${Math.round(dist * 1000)} м` : `${dist.toFixed(1)} км`}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
