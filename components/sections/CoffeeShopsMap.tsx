"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, MapPin, Navigation } from "lucide-react"
import { cn } from "@/lib/utils"

interface Shop {
  city: string
  address: string
  lat: number
  lng: number
}

const SHOPS: Shop[] = [
  // Санкт-Петербург
  { city: "Санкт-Петербург", address: "Гороховая, 53", lat: 59.926693, lng: 30.324357 },
  { city: "Санкт-Петербург", address: "Правды, 5", lat: 59.923942, lng: 30.342845 },
  { city: "Санкт-Петербург", address: "Дыбенко, 24", lat: 59.906305, lng: 30.479128 },
  { city: "Санкт-Петербург", address: "Кудрово, Пражская 7", lat: 59.907825, lng: 30.513992 },
  // Калининград
  { city: "Калининград", address: "Ульяны-Громовой, 15", lat: 54.671019, lng: 20.501136 },
  { city: "Калининград", address: "Советский проспект, 6а", lat: 54.722212, lng: 20.499501 },
  { city: "Калининград", address: "Черняховского, 15", lat: 54.720782, lng: 20.510532 },
  { city: "Калининград", address: "Панина, 2а", lat: 54.747595, lng: 20.499348 },
  { city: "Калининград", address: "Ленинский, 8Б", lat: 54.715238, lng: 20.503283 },
  { city: "Калининград", address: "Аллея Смелых, 39", lat: 54.687004, lng: 20.523845 },
  { city: "Калининград", address: "Липовая Аллея, 2", lat: 54.731908, lng: 20.550714 },
  { city: "Калининград", address: "Крымская, 8", lat: 54.707941, lng: 20.587428 },
  { city: "Калининград", address: "Орудийная, 24", lat: 54.731061, lng: 20.5572 },
  { city: "Калининград", address: "Восточная 1, СО Октябрьское", lat: 54.711941, lng: 20.578247 },
  { city: "Калининград", address: "Карла Маркса, 18", lat: 54.728675, lng: 20.480762 },
  { city: "Калининград", address: "Артиллерийская, 22", lat: 54.731976, lng: 20.540796 },
  { city: "Калининград", address: "Герцена, 31", lat: 54.749834, lng: 20.528885 },
  { city: "Калининград", address: "Московский проспект, 242", lat: 54.708321, lng: 20.568195 },
  // Калининградская область
  { city: "Советск", address: "Гончарова, 2а", lat: 55.082003, lng: 21.892851 },
  { city: "Черняховск", address: "Пионерская, 1", lat: 54.635568, lng: 21.811553 },
  { city: "Гурьевск", address: "Каштановая, 1г", lat: 54.763649, lng: 20.608835 },
  { city: "Пионерский", address: "Комсомольская, 54", lat: 54.953132, lng: 20.235684 },
  { city: "Светлогорск", address: "Калининградский проспект, 3", lat: 54.931158, lng: 20.166585 },
  { city: "Зеленоградск", address: "Марины Расковой, 4а", lat: 54.956244, lng: 20.485667 },
  { city: "Большое Исаково", address: "Калининградская, 1в", lat: 54.72256, lng: 20.602699 },
  // Новосибирск
  { city: "Новосибирск", address: "Дуси Ковальчук, 179 к1", lat: 55.060668, lng: 82.912623 },
  { city: "Новосибирск", address: "Мичурина, 12", lat: 55.041942, lng: 82.923735 },
  { city: "Новосибирск", address: "Красный проспект, 70", lat: 55.043077, lng: 82.917573 },
]

// City centers for zoom
const CITY_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  "Санкт-Петербург": { lat: 59.916, lng: 30.4, zoom: 11 },
  "Калининград": { lat: 54.72, lng: 20.51, zoom: 12 },
  "Новосибирск": { lat: 55.048, lng: 82.918, zoom: 13 },
}

function shopKey(shop: Shop) {
  return `${shop.city}|${shop.address}`
}

function belongsToKaliningrad(city: string) {
  return !["Санкт-Петербург", "Новосибирск"].includes(city)
}

export function CoffeeShopsMap() {
  const [open, setOpen] = useState(false)
  const [selectedCity, setSelectedCity] = useState("Калининград")
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState("")
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<YMapInstance | null>(null)
  const markersRef = useRef<Map<string, { el: HTMLDivElement; marker: unknown }>>(new Map())
  const listRef = useRef<HTMLDivElement>(null)

  // Fetch API key
  useEffect(() => {
    if (!open || apiKey) return
    fetch("/api/delivery/settings")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("settings fetch failed"))))
      .then((data) => {
        if (data?.yandexMapsApiKey) setApiKey(data.yandexMapsApiKey)
        else setLoadError("Карта временно недоступна")
      })
      .catch(() => setLoadError("Не удалось загрузить карту. Обновите страницу."))
  }, [open, apiKey])

  // Load script
  useEffect(() => {
    if (!apiKey || scriptLoaded) return
    if (document.querySelector("script[src*='api-maps.yandex.ru']")) {
      setScriptLoaded(true)
      return
    }
    const script = document.createElement("script")
    script.src = `https://api-maps.yandex.ru/v3/?apikey=${apiKey}&lang=ru_RU`
    script.async = true
    script.defer = true
    script.onload = () => setScriptLoaded(true)
    script.onerror = () => setLoadError("Не удалось загрузить Яндекс.Карты")
    document.head.appendChild(script)
  }, [apiKey, scriptLoaded])

  const cityShops = SHOPS.filter((s) => {
    if (selectedCity === "Калининград") return belongsToKaliningrad(s.city)
    return s.city === selectedCity
  })

  const selectedShop = selectedKey ? cityShops.find((s) => shopKey(s) === selectedKey) ?? null : null

  // Create map once when script + container are ready
  const ensureMap = useCallback(async () => {
    if (!scriptLoaded || !mapRef.current || !window.ymaps3) return null
    if (mapInstanceRef.current) return mapInstanceRef.current

    try {
      await window.ymaps3.ready
      if (!mapRef.current) return null
      const cityCenter = CITY_CENTERS[selectedCity] || { lat: 54.72, lng: 20.51, zoom: 12 }
      const map = new window.ymaps3.YMap(mapRef.current, {
        location: { center: [cityCenter.lng, cityCenter.lat], zoom: cityCenter.zoom },
      })
      map.addChild(new window.ymaps3.YMapDefaultSchemeLayer())
      map.addChild(new window.ymaps3.YMapDefaultFeaturesLayer())
      mapInstanceRef.current = map
      return map
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("Map init error:", err)
      setLoadError("Ошибка инициализации карты")
      return null
    }
  // We intentionally exclude selectedCity — we only want first creation here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded])

  // Sync markers + center when city changes (or after first map creation)
  const syncCity = useCallback(async () => {
    const map = await ensureMap()
    if (!map) return

    const cityCenter = CITY_CENTERS[selectedCity] || { lat: 54.72, lng: 20.51, zoom: 12 }
    map.update({ location: { center: [cityCenter.lng, cityCenter.lat], zoom: cityCenter.zoom } })

    const shops = SHOPS.filter((s) =>
      selectedCity === "Калининград" ? belongsToKaliningrad(s.city) : s.city === selectedCity
    )
    const wantKeys = new Set(shops.map(shopKey))

    // Remove markers no longer needed
    for (const [key, entry] of markersRef.current) {
      if (!wantKeys.has(key)) {
        try { map.removeChild(entry.marker as never) } catch {}
        markersRef.current.delete(key)
      }
    }

    // Add new markers
    for (const shop of shops) {
      const key = shopKey(shop)
      if (markersRef.current.has(key)) continue

      const el = document.createElement("div")
      el.style.cssText = [
        "width:30px",
        "height:30px",
        "background:#2d6b4a",
        "border-radius:50%",
        "border:3px solid white",
        "box-shadow:0 2px 10px rgba(0,0,0,0.35)",
        "cursor:pointer",
        "position:relative",
        "transition:transform 200ms ease, background 200ms ease",
      ].join(";")
      el.title = `${shop.city !== selectedCity && selectedCity === "Калининград" ? shop.city + ", " : ""}${shop.address}`
      el.addEventListener("click", (e) => {
        e.stopPropagation()
        setSelectedKey(key)
      })

      const marker = new window.ymaps3!.YMapMarker({ coordinates: [shop.lng, shop.lat] })
      marker.element.appendChild(el)
      map.addChild(marker)
      markersRef.current.set(key, { el, marker })
    }
  }, [ensureMap, selectedCity])

  useEffect(() => {
    if (open) syncCity()
  }, [open, syncCity])

  useEffect(() => {
    if (!open) return
    setSelectedKey(null)
    // syncCity is already wired via the effect above through dependency on selectedCity → syncCity ref
  }, [selectedCity, open])

  // Visually highlight the selected marker + pan map
  useEffect(() => {
    for (const [key, { el }] of markersRef.current) {
      const active = key === selectedKey
      el.style.background = active ? "#1a4d33" : "#2d6b4a"
      el.style.transform = active ? "scale(1.35)" : "scale(1)"
      el.style.zIndex = active ? "100" : "1"
      el.style.boxShadow = active
        ? "0 0 0 4px rgba(26,77,51,0.25), 0 4px 14px rgba(0,0,0,0.45)"
        : "0 2px 10px rgba(0,0,0,0.35)"
    }

    if (selectedShop && mapInstanceRef.current) {
      mapInstanceRef.current.update({
        location: { center: [selectedShop.lng, selectedShop.lat], zoom: 15 },
      })
    }

    // Scroll list item into view
    if (selectedKey && listRef.current) {
      const listItem = listRef.current.querySelector<HTMLElement>(
        `[data-shop-key="${CSS.escape(selectedKey)}"]`
      )
      listItem?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [selectedKey, selectedShop])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open])

  // Prevent body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [open])

  const cityCounts = ["Калининград", "Санкт-Петербург", "Новосибирск"].map((city) => ({
    city,
    count: SHOPS.filter((s) => city === "Калининград" ? belongsToKaliningrad(s.city) : s.city === city).length,
  }))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-6 py-3 mt-6 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-colors"
      >
        <MapPin className="w-4 h-4" strokeWidth={1.75} />
        Карта кофе-шопов Millor
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0">
              <h2 className="font-sans text-lg sm:text-xl font-bold text-foreground">Наши кофе-шопы</h2>
              <button
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            {/* City tabs */}
            <div className="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-border overflow-x-auto scrollbar-hide shrink-0">
              {cityCounts.map(({ city, count }) => (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  className={cn(
                    "h-9 px-4 rounded-lg text-sm font-medium whitespace-nowrap transition-colors shrink-0 inline-flex items-center",
                    selectedCity === city
                      ? "bg-primary text-white"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  )}
                >
                  {city}
                  <span className="ml-1.5 opacity-60 text-xs">({count})</span>
                </button>
              ))}
            </div>

            {/* Map + List */}
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0">
              {/* Map */}
              <div className="relative flex-1 min-h-[240px] sm:min-h-0">
                {loadError ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                    <p className="text-sm text-muted-foreground">{loadError}</p>
                    <button
                      onClick={() => { setLoadError(null); setApiKey(""); setScriptLoaded(false) }}
                      className="h-9 px-4 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      Попробовать снова
                    </button>
                  </div>
                ) : apiKey ? (
                  <div ref={mapRef} className="w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    Загружаем карту...
                  </div>
                )}

                {/* Selected shop info panel overlay */}
                {selectedShop && (
                  <div className="absolute left-2 right-2 bottom-2 sm:left-4 sm:right-4 sm:bottom-4 bg-white rounded-xl shadow-lg border border-border p-3 sm:p-4 flex items-start gap-3 z-10 animate-fade-in">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-primary" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        Кофе-шоп Millor
                        {selectedShop.city !== selectedCity && ` · ${selectedShop.city}`}
                      </p>
                      <p className="text-sm font-semibold text-foreground truncate">{selectedShop.address}</p>
                    </div>
                    <a
                      href={`https://yandex.ru/maps/?rtext=~${selectedShop.lat},${selectedShop.lng}&rtt=auto`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span className="hidden sm:inline">Маршрут</span>
                    </a>
                    <button
                      onClick={() => setSelectedKey(null)}
                      aria-label="Скрыть"
                      className="shrink-0 w-9 h-9 rounded-lg text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center"
                    >
                      <X className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>
                )}
              </div>

              {/* Address list */}
              <div
                ref={listRef}
                className="sm:w-72 border-t sm:border-t-0 sm:border-l border-border overflow-y-auto max-h-48 sm:max-h-none shrink-0"
              >
                {cityShops.map((shop) => {
                  const key = shopKey(shop)
                  const active = key === selectedKey
                  return (
                    <button
                      key={key}
                      data-shop-key={key}
                      onClick={() => setSelectedKey(key)}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-border last:border-0 transition-colors flex items-start gap-2",
                        active ? "bg-primary/5" : "hover:bg-muted/50"
                      )}
                    >
                      <MapPin
                        className={cn(
                          "w-4 h-4 shrink-0 mt-0.5 transition-colors",
                          active ? "text-primary" : "text-muted-foreground"
                        )}
                        strokeWidth={1.75}
                      />
                      <div className="min-w-0 flex-1">
                        {shop.city !== selectedCity && selectedCity === "Калининград" && (
                          <p className="text-[11px] text-muted-foreground">{shop.city}</p>
                        )}
                        <p className={cn(
                          "text-sm truncate",
                          active ? "text-primary font-semibold" : "text-foreground"
                        )}>
                          {shop.address}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
