"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { Search, X, MapPin, List, Map as MapIcon, Check } from "lucide-react"
import { useDeliveryStore } from "@/lib/store/delivery"
import type { PickupPoint } from "@/lib/delivery/types"

interface SuggestionDTO {
  value: string
  postalCode: string
  lat?: number | null
  lng?: number | null
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function hasCoords(p: Pick<PickupPoint, "lat" | "lng">): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0)
}

type ClustererModule = {
  YMapClusterer: new (props: {
    method: unknown
    features: YMapClustererFeature[]
    marker: (feature: YMapClustererFeature) => YMapMarkerInstance
    cluster: (coordinates: number[], features: YMapClustererFeature[]) => YMapMarkerInstance
  }) => YMapClustererInstance
  clusterByGrid: (opts: { gridSize: number }) => unknown
}

interface Props {
  open: boolean
  onClose: () => void
}

export function PickupPointModal({ open, onClose }: Props) {
  const city = useDeliveryStore((s) => s.city)
  const cityCode = useDeliveryStore((s) => s.cityCode)
  const region = useDeliveryStore((s) => s.region)
  const postalCode = useDeliveryStore((s) => s.postalCode)
  const selectedRate = useDeliveryStore((s) => s.selectedRate)
  const pickupPoints = useDeliveryStore((s) => s.pickupPoints)
  const pickupPointsLoading = useDeliveryStore((s) => s.pickupPointsLoading)
  const selectedPickupPoint = useDeliveryStore((s) => s.selectedPickupPoint)
  const setPickupPoints = useDeliveryStore((s) => s.setPickupPoints)
  const setPickupPointsLoading = useDeliveryStore((s) => s.setPickupPointsLoading)
  const selectPickupPoint = useDeliveryStore((s) => s.selectPickupPoint)

  // Выбор внутри модалки — подтверждается только по кнопке «Выбрать».
  // Это позволяет юзеру пролистывать точки, не коммитя каждую случайно.
  const [draftPoint, setDraftPoint] = useState<PickupPoint | null>(null)
  // Ref-зеркало draftPoint используется в marker-callbacks карты, чтобы
  // клик по точке НЕ инвалидировал useCallback(initMap) и не вызывал
  // дорогой destroy+reinit карты при каждом выборе.
  const draftPointRef = useRef<PickupPoint | null>(null)
  useEffect(() => {
    draftPointRef.current = draftPoint
  }, [draftPoint])

  const [apiKey, setApiKey] = useState("")
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<YMapInstance | null>(null)
  const clustererRef = useRef<YMapClustererInstance | null>(null)
  const clustererModuleRef = useRef<ClustererModule | null>(null)
  const [mapError, setMapError] = useState(false)
  // Mobile tabs: карта или список. На desktop оба видны одновременно (split-view).
  const [mobileTab, setMobileTab] = useState<"map" | "list">("list")

  const [searchQuery, setSearchQuery] = useState("")
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionDTO[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  // При открытии синхронизируем черновик с реальным выбором
  useEffect(() => {
    if (open) setDraftPoint(selectedPickupPoint)
  }, [open, selectedPickupPoint])

  // Scroll-lock + ESC to close + focus trap внутри модалки.
  // Tab за пределы модалки — ловим и возвращаем к первому элементу,
  // чтобы screen reader и клавиатурные юзеры не уходили в невидимый
  // фон под overlay.
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function getFocusable(): HTMLElement[] {
      if (!dialogRef.current) return []
      return Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("aria-hidden") && el.offsetParent !== null)
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key === "Tab") {
        const focusable = getFocusable()
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        const active = document.activeElement as HTMLElement | null
        if (e.shiftKey && active === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener("keydown", handleKey)

    // На открытии фокусируем первый фокусируемый элемент внутри модалки —
    // это «заголовок-close» button, что сразу позволяет ESC-менее юзерам
    // закрыть.
    const focusTimer = setTimeout(() => {
      const focusable = getFocusable()
      focusable[0]?.focus()
    }, 50)

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener("keydown", handleKey)
      clearTimeout(focusTimer)
    }
  }, [open, onClose])

  // Settings (Yandex API key)
  useEffect(() => {
    if (!open || apiKey) return
    fetch("/api/delivery/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.yandexMapsApiKey && setApiKey(data.yandexMapsApiKey))
      .catch(() => {})
  }, [open, apiKey])

  // Fetch pickup points
  useEffect(() => {
    if (!open || !cityCode || selectedRate?.deliveryType !== "pvz") return

    setPickupPoints([])
    setPickupPointsLoading(true)
    const params = new URLSearchParams({ city_code: cityCode, carrier: selectedRate.carrier })
    if (city) params.set("city", city)
    if (region) params.set("region", region)
    if (postalCode) params.set("postal_code", postalCode)
    // I3: 15-секундный timeout. Раньше при зависшем CDEK/Почта-апи модалка
    // оставалась в loading навсегда, юзер в тупике. AbortController
    // прерывает соединение, fetch падает в catch — переходим в state
    // «попробуйте обновить».
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 15000)
    fetch(`/api/delivery/pickup-points?${params}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((points) => {
        setPickupPoints(points)
        setPickupPointsLoading(false)
      })
      .catch(() => setPickupPointsLoading(false))
      .finally(() => clearTimeout(timer))
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cityCode, selectedRate?.carrier, selectedRate?.deliveryType, region, postalCode])

  // Reset search when context changes
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

  const cityCenter = useMemo(() => {
    const coords = pickupPoints.filter(hasCoords)
    if (coords.length === 0) return null
    return {
      lat: median(coords.map((p) => p.lat)),
      lng: median(coords.map((p) => p.lng)),
    }
  }, [pickupPoints])

  const visiblePoints = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let points = pickupPoints
    if (q && !searchCenter) {
      points = points.filter(
        (p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q)
      )
    }
    const sortCenter = searchCenter || cityCenter
    if (sortCenter) {
      points = [...points].sort((a, b) => {
        const aHas = hasCoords(a)
        const bHas = hasCoords(b)
        if (!aHas && !bHas) return 0
        if (!aHas) return 1
        if (!bHas) return -1
        return (
          distanceKm(sortCenter.lat, sortCenter.lng, a.lat, a.lng) -
          distanceKm(sortCenter.lat, sortCenter.lng, b.lat, b.lng)
        )
      })
    }
    return points
  }, [pickupPoints, searchQuery, searchCenter, cityCenter])

  const mappablePoints = useMemo(
    () => visiblePoints.filter(hasCoords),
    [visiblePoints]
  )

  const distances = useMemo(() => {
    if (!searchCenter) return new Map<string, number>()
    const map = new Map<string, number>()
    for (const p of pickupPoints) {
      if (!hasCoords(p)) continue
      map.set(p.code, distanceKm(searchCenter.lat, searchCenter.lng, p.lat, p.lng))
    }
    return map
  }, [pickupPoints, searchCenter])

  // Load Yandex Maps script
  useEffect(() => {
    if (!open || !apiKey || scriptLoaded) return
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
  }, [open, apiKey, scriptLoaded])

  const initMap = useCallback(async () => {
    if (!scriptLoaded || !mapRef.current || mappablePoints.length === 0) return
    if (!window.ymaps3) {
      setMapError(true)
      return
    }
    try {
      await window.ymaps3.ready
      if (!clustererModuleRef.current) {
        try {
          const mod = (await window.ymaps3.import(
            "@yandex/ymaps3-clusterer@0.0.1"
          )) as ClustererModule
          clustererModuleRef.current = mod
        } catch (err) {
          console.error("Failed to load YMapClusterer module:", err)
          setMapError(true)
          return
        }
      }
      const { YMapClusterer, clusterByGrid } = clustererModuleRef.current

      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy()
        mapInstanceRef.current = null
        clustererRef.current = null
      }

      const focus =
        searchCenter || cityCenter || { lat: mappablePoints[0].lat, lng: mappablePoints[0].lng }
      const center = [focus.lng, focus.lat]
      const map = new window.ymaps3.YMap(mapRef.current, {
        location: { center, zoom: searchCenter ? 14 : 11 },
      })

      map.addChild(new window.ymaps3.YMapDefaultSchemeLayer())
      map.addChild(new window.ymaps3.YMapDefaultFeaturesLayer())

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

      const features: YMapClustererFeature[] = mappablePoints.map((p) => ({
        type: "Feature",
        id: p.code,
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      }))

      const markerElementFor = (pointCode: string) => {
        const point = mappablePoints.find((p) => p.code === pointCode)
        const el = document.createElement("div")
        el.className = "ymaps-marker"
        el.style.cssText =
          "width:24px;height:24px;background:#2d6b4a;border-radius:50%;border:2px solid white;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.3);"
        el.title = point?.name || ""
        return el
      }

      const clusterElementFor = (count: number) => {
        const el = document.createElement("div")
        const size = count < 10 ? 32 : count < 50 ? 40 : count < 200 ? 48 : 56
        el.style.cssText = `
          width:${size}px;height:${size}px;background:#7c4a1e;color:white;
          border-radius:50%;border:3px solid white;cursor:pointer;
          box-shadow:0 2px 6px rgba(0,0,0,0.35);
          display:flex;align-items:center;justify-content:center;
          font-weight:700;font-size:${count < 100 ? 13 : 12}px;`
        el.textContent = String(count)
        return el
      }

      const clusterer = new YMapClusterer({
        method: clusterByGrid({ gridSize: 64 }),
        features,
        marker: (feature) => {
          const point = mappablePoints.find((p) => p.code === feature.id)
          const el = markerElementFor(feature.id)
          return new window.ymaps3!.YMapMarker(
            {
              coordinates: feature.geometry.coordinates,
              // Используем ref, чтобы клик по маркеру не инвалидировал
              // замыкание initMap и не триггерил destroy+reinit карты.
              onClick: () => point && setDraftPoint(point),
            },
            el
          )
        },
        cluster: (coordinates, featuresInCluster) => {
          const el = clusterElementFor(featuresInCluster.length)
          return new window.ymaps3!.YMapMarker({ coordinates }, el)
        },
      })
      map.addChild(clusterer)
      clustererRef.current = clusterer

      mapInstanceRef.current = map
      setMapError(false)
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("Yandex Maps init error:", err)
      setMapError(true)
    }
    // draftPoint НЕ в deps — визуально подсвечивается только в списке;
    // пересоздавать карту на каждый клик нельзя (destroy+init дорогие).
  }, [scriptLoaded, mappablePoints, searchCenter, cityCenter])

  // Инициализация карты — на desktop всегда; на mobile только когда вкладка "map".
  // При переключении с "list" на "map" контейнер карты из `hidden` становится
  // видимым — в этот момент Yandex мог инициализироваться при width/height=0,
  // поэтому ре-инициализируем.
  useEffect(() => {
    if (!open) return
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      initMap()
    } else if (mobileTab === "map") {
      initMap()
    }
  }, [open, initMap, mobileTab])

  // При закрытии — уничтожаем карту, иначе при повторном открытии двойная инициализация
  useEffect(() => {
    if (open) return
    if (mapInstanceRef.current) {
      mapInstanceRef.current.destroy()
      mapInstanceRef.current = null
      clustererRef.current = null
    }
  }, [open])

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

  function handleConfirm() {
    if (!draftPoint) return
    selectPickupPoint(draftPoint)
    onClose()
  }

  if (!open) return null

  const noMappablePoints = visiblePoints.length > 0 && mappablePoints.length === 0

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pickup-modal-title"
      onClick={(e) => {
        // Клик по backdrop закрывает; клик по контенту модалки — нет.
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* На mobile используем 100svh/100dvh, чтобы при открытой клавиатуре
          модалка корректно укорачивалась (иначе половина контента уходит
          под системный overflow на iOS/Android). */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full h-[100svh] sm:h-[90vh] sm:max-h-[720px] sm:max-w-6xl sm:rounded-2xl shadow-xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-border">
          <div className="min-w-0">
            <h3 id="pickup-modal-title" className="text-lg sm:text-xl font-semibold">
              Выберите пункт выдачи
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {city} — {pickupPointsLoading ? "ищем ПВЗ…" : `${pickupPoints.length} пунктов`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="shrink-0 h-11 w-11 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile tab switcher */}
        <div className="md:hidden border-b border-border px-4 py-2 flex gap-2">
          <button
            type="button"
            onClick={() => setMobileTab("list")}
            className={`flex-1 h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
              mobileTab === "list"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            <List className="w-4 h-4" />
            Список
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("map")}
            disabled={noMappablePoints}
            className={`flex-1 h-10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
              mobileTab === "map"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground"
            }`}
          >
            <MapIcon className="w-4 h-4" />
            Карта
          </button>
        </div>

        {/* Body — split view on desktop, single-pane on mobile */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          {/* Map pane */}
          <div
            className={`md:w-[60%] md:border-r border-border bg-muted relative ${
              mobileTab === "list" ? "hidden md:block" : "flex-1 md:flex-initial"
            }`}
          >
            {mapError || !apiKey ? (
              <div className="h-full flex items-center justify-center p-4">
                <p className="text-sm text-muted-foreground text-center">
                  Карта недоступна. Выберите пункт из списка справа.
                </p>
              </div>
            ) : noMappablePoints ? (
              <div className="h-full flex items-center justify-center p-4">
                <p className="text-sm text-muted-foreground text-center">
                  У найденных точек нет координат.
                  <br />
                  Используйте список.
                </p>
              </div>
            ) : (
              <>
                <div ref={mapRef} className="w-full h-full min-h-[300px]" />
                {(!scriptLoaded || pickupPointsLoading) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 text-sm text-muted-foreground">
                    Загружаем карту…
                  </div>
                )}
              </>
            )}
          </div>

          {/* List pane */}
          <div
            className={`md:w-[40%] flex flex-col min-h-0 ${
              mobileTab === "map" ? "hidden md:flex" : "flex-1 md:flex"
            }`}
          >
            {/* Search */}
            <div ref={searchContainerRef} className="relative p-3 sm:p-4 border-b border-border">
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
                  className="w-full h-10 pl-9 pr-10 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Улица, дом или индекс"
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
                    …
                  </div>
                )}
              </div>

              {suggestOpen && suggestions.length > 0 && (
                <div className="absolute z-10 top-full left-3 right-3 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-56 overflow-y-auto">
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

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {pickupPointsLoading ? (
                <ul className="divide-y divide-border" aria-label="Загружаем пункты выдачи">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <li key={i} className="px-4 py-3 flex items-start gap-2">
                      <div className="shrink-0 w-5 h-5 rounded-full bg-muted animate-pulse mt-0.5" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 bg-muted rounded animate-pulse w-2/3" />
                        <div className="h-3 bg-muted rounded animate-pulse w-full" />
                        <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : visiblePoints.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  {searchQuery ? (
                    <>
                      По запросу ничего не найдено.
                      <br />
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="text-primary hover:underline mt-1"
                      >
                        Сбросить поиск
                      </button>
                    </>
                  ) : (
                    "Нет пунктов выдачи в этом городе"
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {visiblePoints.map((point, index) => {
                    const dist = distances.get(point.code)
                    const isDraft = draftPoint?.code === point.code
                    const noCoords = !hasCoords(point)
                    // Бейдж «Ближайший» ставим на первом элементе отсортированного
                    // списка — visiblePoints уже отсортированы по расстоянию
                    // (cityCenter или searchCenter).
                    const isNearest =
                      index === 0 && hasCoords(point) && (cityCenter !== null || searchCenter !== null)
                    return (
                      <li key={point.code}>
                        <button
                          type="button"
                          onClick={() => setDraftPoint(point)}
                          className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                            isDraft ? "bg-primary/10" : "hover:bg-muted"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                                isDraft ? "border-primary bg-primary" : "border-muted-foreground/30"
                              }`}
                            >
                              {isDraft && (
                                <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{point.name}</p>
                                {isNearest && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold uppercase tracking-wide">
                                    Ближайший
                                  </span>
                                )}
                                {noCoords && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold uppercase tracking-wide">
                                    Без карты
                                  </span>
                                )}
                              </div>
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
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border p-3 sm:p-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          {draftPoint ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{draftPoint.name}</p>
                <p className="text-xs text-muted-foreground truncate">{draftPoint.address}</p>
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                className="shrink-0 h-11 px-5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Выбрать этот пункт
              </button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-1.5">
              Выберите пункт на карте или в списке
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
