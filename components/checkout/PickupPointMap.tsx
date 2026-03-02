"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useDeliveryStore } from "@/lib/store/delivery"

declare global {
  interface Window {
    ymaps3?: {
      ready: Promise<void>
      YMap: new (
        el: HTMLElement,
        props: { location: { center: number[]; zoom: number } }
      ) => YMap
      YMapDefaultSchemeLayer: new () => unknown
      YMapDefaultFeaturesLayer: new () => unknown
      YMapMarker: new (props: { coordinates: number[]; onClick?: () => void }) => YMapMarker
    }
  }
}

interface YMap {
  addChild(child: unknown): void
  removeChild(child: unknown): void
  update(props: { location: { center: number[]; zoom: number } }): void
  destroy(): void
}

interface YMapMarker {
  element: HTMLElement
}

export function PickupPointMap() {
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
  const mapInstanceRef = useRef<YMap | null>(null)
  const [listView, setListView] = useState(false)

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
    fetch(`/api/delivery/pickup-points?city_code=${cityCode}&carrier=${selectedRate.carrier}`)
      .then((r) => r.ok ? r.json() : [])
      .then((points) => {
        setPickupPoints(points)
        setPickupPointsLoading(false)
      })
      .catch(() => setPickupPointsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityCode, selectedRate?.carrier, selectedRate?.deliveryType])

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
    document.head.appendChild(script)
  }, [apiKey, scriptLoaded])

  // Init map
  const initMap = useCallback(async () => {
    if (!scriptLoaded || !mapRef.current || pickupPoints.length === 0) return
    if (!window.ymaps3) return

    await window.ymaps3.ready

    // Destroy prev
    if (mapInstanceRef.current) {
      mapInstanceRef.current.destroy()
      mapInstanceRef.current = null
    }

    const center = [pickupPoints[0].lng, pickupPoints[0].lat]
    const map = new window.ymaps3.YMap(mapRef.current, {
      location: { center, zoom: 12 },
    })

    map.addChild(new window.ymaps3.YMapDefaultSchemeLayer())
    map.addChild(new window.ymaps3.YMapDefaultFeaturesLayer())

    // Add markers (limit to 100 for performance)
    const points = pickupPoints.slice(0, 100)
    for (const point of points) {
      const el = document.createElement("div")
      el.className = "ymaps-marker"
      el.style.cssText =
        "width:24px;height:24px;background:#8B4513;border-radius:50%;border:2px solid white;cursor:pointer;box-shadow:0 2px 4px rgba(0,0,0,0.3);"
      el.title = point.name

      const marker = new window.ymaps3.YMapMarker({
        coordinates: [point.lng, point.lat],
        onClick: () => selectPickupPoint(point),
      })
      marker.element.appendChild(el)
      map.addChild(marker)
    }

    mapInstanceRef.current = map
  }, [scriptLoaded, pickupPoints, selectPickupPoint])

  useEffect(() => {
    initMap()
  }, [initMap])

  if (selectedRate?.deliveryType !== "pvz") return null

  if (pickupPointsLoading) {
    return (
      <div className="py-4 text-center text-sm text-muted-foreground">
        Загружаем пункты выдачи...
      </div>
    )
  }

  if (pickupPoints.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Нет пунктов выдачи в этом городе</p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          Пункт выдачи ({pickupPoints.length})
        </label>
        <button
          type="button"
          onClick={() => setListView(!listView)}
          className="text-xs text-primary hover:underline"
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

      {!listView && apiKey ? (
        <div
          ref={mapRef}
          className="w-full h-64 rounded-xl overflow-hidden border border-border"
        />
      ) : (
        <div className="max-h-60 overflow-y-auto border border-border rounded-xl divide-y divide-border">
          {pickupPoints.slice(0, 50).map((point) => (
            <button
              key={point.code}
              type="button"
              onClick={() => selectPickupPoint(point)}
              className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                selectedPickupPoint?.code === point.code
                  ? "bg-primary/5"
                  : "hover:bg-muted"
              }`}
            >
              <p className="font-medium">{point.name}</p>
              <p className="text-xs text-muted-foreground">{point.address}</p>
              {point.workTime && (
                <p className="text-xs text-muted-foreground">{point.workTime}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
