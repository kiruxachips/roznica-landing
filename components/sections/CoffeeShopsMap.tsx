"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { X, MapPin } from "lucide-react"

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

const CITIES = [...new Set(SHOPS.map((s) => s.city))]

// City centers for zoom
const CITY_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  "Санкт-Петербург": { lat: 59.916, lng: 30.4, zoom: 11 },
  "Калининград": { lat: 54.72, lng: 20.51, zoom: 12 },
  "Новосибирск": { lat: 55.048, lng: 82.918, zoom: 13 },
}


export function CoffeeShopsMap() {
  const [open, setOpen] = useState(false)
  const [selectedCity, setSelectedCity] = useState("Калининград")
  const [apiKey, setApiKey] = useState("")
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  // Fetch API key
  useEffect(() => {
    if (!open) return
    fetch("/api/delivery/settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data?.yandexMapsApiKey && setApiKey(data.yandexMapsApiKey))
      .catch(() => {})
  }, [open])

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
    script.onload = () => setScriptLoaded(true)
    document.head.appendChild(script)
  }, [apiKey, scriptLoaded])

  const initMap = useCallback(async () => {
    const ymaps3 = (window as any).ymaps3
    if (!scriptLoaded || !mapRef.current || !ymaps3) return

    try {
      await ymaps3.ready

      if (mapInstanceRef.current) {
        mapInstanceRef.current.destroy()
        mapInstanceRef.current = null
      }

      const cityCenter = CITY_CENTERS[selectedCity] || { lat: 54.72, lng: 20.51, zoom: 12 }
      const map = new ymaps3.YMap(mapRef.current, {
        location: { center: [cityCenter.lng, cityCenter.lat], zoom: cityCenter.zoom },
      })

      map.addChild(new ymaps3.YMapDefaultSchemeLayer())
      map.addChild(new ymaps3.YMapDefaultFeaturesLayer())

      const cityShops = SHOPS.filter((s) => {
        if (selectedCity === "Калининград") {
          // Include Kaliningrad oblast towns
          return !["Санкт-Петербург", "Новосибирск"].includes(s.city)
        }
        return s.city === selectedCity
      })

      for (const shop of cityShops) {
        const el = document.createElement("div")
        el.style.cssText = "width:28px;height:28px;background:#2d6b4a;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);cursor:pointer;position:relative;"
        el.title = `${shop.city}, ${shop.address}`

        const marker = new ymaps3.YMapMarker({ coordinates: [shop.lng, shop.lat] })
        marker.element.appendChild(el)
        map.addChild(marker)
      }

      mapInstanceRef.current = map
    } catch (err) {
      console.error("Map init error:", err)
    }
  }, [scriptLoaded, selectedCity])

  useEffect(() => {
    if (open) initMap()
  }, [open, initMap])

  // Update map when city changes
  useEffect(() => {
    if (!open || !mapInstanceRef.current) {
      initMap()
      return
    }
    // Reinit to update markers
    initMap()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCity])

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

  const cityShops = SHOPS.filter((s) => {
    if (selectedCity === "Калининград") {
      return !["Санкт-Петербург", "Новосибирск"].includes(s.city)
    }
    return s.city === selectedCity
  })

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-6 py-3 mt-6 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-colors"
      >
        <MapPin className="w-4 h-4" />
        Карта кофе-шопов Millor
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-serif text-xl font-bold text-foreground">Наши кофе-шопы</h2>
              <button
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* City tabs */}
            <div className="flex gap-2 px-6 py-3 border-b border-border overflow-x-auto">
              {["Калининград", "Санкт-Петербург", "Новосибирск"].map((city) => (
                <button
                  key={city}
                  onClick={() => setSelectedCity(city)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCity === city
                      ? "bg-primary text-white"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                  }`}
                >
                  {city}
                  <span className="ml-1 opacity-60">
                    ({SHOPS.filter((s) => {
                      if (city === "Калининград") return !["Санкт-Петербург", "Новосибирск"].includes(s.city)
                      return s.city === city
                    }).length})
                  </span>
                </button>
              ))}
            </div>

            {/* Map + List */}
            <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
              {/* Map */}
              <div className="flex-1 min-h-[300px] sm:min-h-0">
                {apiKey ? (
                  <div ref={mapRef} className="w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    Загружаем карту...
                  </div>
                )}
              </div>

              {/* Address list */}
              <div className="sm:w-72 border-t sm:border-t-0 sm:border-l border-border overflow-y-auto max-h-48 sm:max-h-none">
                {cityShops.map((shop, i) => (
                  <div
                    key={i}
                    className="px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        {shop.city !== selectedCity && shop.city !== "Калининград" && (
                          <p className="text-xs text-muted-foreground">{shop.city}</p>
                        )}
                        <p className="text-sm text-foreground">{shop.address}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
