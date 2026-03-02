"use client"

import { useState } from "react"
import { createShipmentManual, refreshTracking } from "@/lib/actions/delivery"

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
}: Props) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  async function handleCreateShipment() {
    setLoading(true)
    setMessage("")
    const result = await createShipmentManual(orderId)
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
      window.location.reload()
    } else {
      setMessage(`Ошибка: ${result.error}`)
    }
    setLoading(false)
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
          <div>
            <span className="text-muted-foreground">Трек-номер:</span>
            <p className="font-medium font-mono">{trackingNumber}</p>
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
      </div>

      <div className="flex gap-2 mt-4">
        {!carrierOrderId && (
          <button
            onClick={handleCreateShipment}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Создать отправку"}
          </button>
        )}
        {carrierOrderId && deliveryMethod === "cdek" && (
          <button
            onClick={handleRefreshTracking}
            disabled={loading}
            className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Обновить статус"}
          </button>
        )}
      </div>

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
