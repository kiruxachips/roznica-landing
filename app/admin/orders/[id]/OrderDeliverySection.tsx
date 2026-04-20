"use client"

import { useState, useEffect } from "react"
import { ExternalLink } from "lucide-react"
import { createShipmentManual, refreshTracking } from "@/lib/actions/delivery"
import { PackagePlanViewer } from "@/components/admin/PackagePlanViewer"

interface TrackingEvent {
  code: string
  name: string
  date: string
  cityName?: string
}

interface SenderLocation {
  name: string
  city: string
  cityCode: string
  postalCode: string
  isDefault: boolean
}

interface Props {
  orderId: string
  deliveryMethod: string | null
  deliveryType: string | null
  destinationCity: string | null
  estimatedDelivery: string | null
  trackingNumber: string | null
  carrierOrderId: string | null
  carrierOrderNum: string | null
  carrierStatus: string | null
  pickupPointName: string | null
  packagePlan: unknown
  packageWeight: number | null
  tariffCode: number | null
}

const carrierLabels: Record<string, string> = {
  cdek: "СДЭК",
  pochta: "Почта России",
  courier: "Курьер",
}

export function OrderDeliverySection({
  orderId,
  deliveryMethod,
  deliveryType,
  destinationCity,
  estimatedDelivery,
  trackingNumber,
  carrierOrderId,
  carrierOrderNum,
  carrierStatus,
  pickupPointName,
  packagePlan,
  packageWeight,
  tariffCode,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [senderLocations, setSenderLocations] = useState<SenderLocation[]>([])
  const [selectedSender, setSelectedSender] = useState<number>(0)
  const [trackingHistory, setTrackingHistory] = useState<TrackingEvent[]>([])

  // Load sender locations for shipment creation
  useEffect(() => {
    if (carrierOrderId) return // Already shipped, no need
    fetch("/api/delivery/sender-locations")
      .then((r) => r.ok ? r.json() : [])
      .then((locations: SenderLocation[]) => {
        setSenderLocations(locations)
        const defaultIdx = locations.findIndex((l) => l.isDefault)
        if (defaultIdx >= 0) setSelectedSender(defaultIdx)
      })
      .catch(() => {})
  }, [carrierOrderId])

  async function handleCreateShipment() {
    setLoading(true)
    setMessage("")
    const result = await createShipmentManual(orderId, selectedSender)
    if (result.success) {
      setMessage("Отправка создана!")
      window.location.reload()
    } else {
      setMessage(`Ошибка: ${result.error}`)
    }
    setLoading(false)
  }

  async function handleRefreshTracking() {
    setLoading(true)
    setMessage("")
    const result = await refreshTracking(orderId)
    if (result.success) {
      setMessage("Статус обновлён")
      if (result.statuses && result.statuses.length > 0) {
        setTrackingHistory(result.statuses as TrackingEvent[])
      } else {
        window.location.reload()
      }
    } else {
      setMessage(`Ошибка: ${result.error}`)
    }
    setLoading(false)
  }

  /** Список трек-номеров с ссылками — для multi-box Pochta их может быть несколько через запятую. */
  function getTrackingLinks(): Array<{ code: string; url: string | null }> {
    if (!trackingNumber) return []
    const codes = trackingNumber
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    return codes.map((code) => {
      if (deliveryMethod === "pochta") return { code, url: `https://www.pochta.ru/tracking#${code}` }
      if (deliveryMethod === "cdek") return { code, url: `https://www.cdek.ru/ru/tracking?order_id=${code}` }
      return { code, url: null }
    })
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
      <h2 className="text-lg font-semibold mb-4">Доставка</h2>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Перевозчик:</span>
          <p className="font-medium">{carrierLabels[deliveryMethod || ""] || deliveryMethod}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Тип:</span>
          <p className="font-medium">
            {deliveryType === "pvz" ? "Пункт выдачи" : "До двери"}
          </p>
        </div>
        {destinationCity && (
          <div>
            <span className="text-muted-foreground">Город:</span>
            <p className="font-medium">{destinationCity}</p>
          </div>
        )}
        {estimatedDelivery && (
          <div>
            <span className="text-muted-foreground">Срок:</span>
            <p className="font-medium">{estimatedDelivery}</p>
          </div>
        )}
        {pickupPointName && (
          <div className="col-span-2">
            <span className="text-muted-foreground">Пункт выдачи:</span>
            <p className="font-medium">{pickupPointName}</p>
          </div>
        )}
        {trackingNumber && (
          <div className="col-span-2">
            <span className="text-muted-foreground">
              Трек-номер{getTrackingLinks().length > 1 ? `а (${getTrackingLinks().length} коробки)` : ""}:
            </span>
            <div className="flex flex-col gap-1 mt-0.5">
              {getTrackingLinks().map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <p className="font-medium font-mono text-sm">{t.code}</p>
                  {t.url && (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {carrierOrderNum && (
          <div>
            <span className="text-muted-foreground">Номер у перевозчика:</span>
            <p className="font-medium font-mono">{carrierOrderNum}</p>
          </div>
        )}
        {carrierStatus && (
          <div>
            <span className="text-muted-foreground">Статус перевозчика:</span>
            <p className="font-medium">{carrierStatus}</p>
          </div>
        )}
        {tariffCode !== null && (
          <div>
            <span className="text-muted-foreground">Код тарифа:</span>
            <p className="font-medium font-mono">{tariffCode}</p>
          </div>
        )}
        <PackagePlanViewer plan={packagePlan} totalWeight={packageWeight} />
      </div>

      {/* Sender location picker + Create shipment */}
      {!carrierOrderId && (
        <div className="mt-4 space-y-3">
          {senderLocations.length > 1 && (
            <div>
              <label className="block text-sm font-medium mb-1">Склад отправки</label>
              <select
                value={selectedSender}
                onChange={(e) => setSelectedSender(parseInt(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {senderLocations.map((loc, i) => (
                  <option key={i} value={i}>
                    {loc.name} — {loc.city} ({loc.postalCode}){loc.isDefault ? " (по умолчанию)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={handleCreateShipment}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Создать отправку"}
          </button>
        </div>
      )}

      {/* Refresh tracking */}
      {carrierOrderId && ["cdek", "pochta"].includes(deliveryMethod || "") && (
        <div className="mt-4 space-y-3">
          <button
            onClick={handleRefreshTracking}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Обновить статус"}
          </button>

          {trackingHistory.length > 0 && (
            <div className="border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-2">История отслеживания</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {trackingHistory.map((event, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <span className="text-muted-foreground whitespace-nowrap shrink-0">
                      {event.date ? new Date(event.date).toLocaleString("ru-RU", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      }) : "—"}
                    </span>
                    {event.cityName && (
                      <span className="text-muted-foreground shrink-0">{event.cityName}</span>
                    )}
                    <span className="font-medium">{event.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {message && (
        <p
          className={`mt-2 text-sm ${
            message.includes("Ошибка") ? "text-red-600" : "text-green-600"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  )
}
