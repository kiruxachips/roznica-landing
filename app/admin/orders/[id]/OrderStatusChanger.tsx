"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateOrderStatus } from "@/lib/actions/orders"

const statuses = [
  { value: "pending", label: "Новый", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "paid", label: "Оплачен", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { value: "confirmed", label: "Подтверждён", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "shipped", label: "Отправлен", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "delivered", label: "Доставлен", color: "bg-green-50 text-green-700 border-green-200" },
  { value: "payment_failed", label: "Ошибка оплаты", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { value: "cancelled", label: "Отменён", color: "bg-red-50 text-red-700 border-red-200" },
]

const allowedTransitions: Record<string, string[]> = {
  pending: ["paid", "confirmed", "cancelled"],
  paid: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  payment_failed: ["pending", "cancelled"],
  cancelled: [],
}

export function OrderStatusChanger({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const allowed = allowedTransitions[currentStatus] || []

  async function handleChange(status: string) {
    setSaving(true)
    setError("")
    try {
      await updateOrderStatus(orderId, status)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка смены статуса")
    } finally {
      setSaving(false)
    }
  }

  const currentStatusInfo = statuses.find((s) => s.value === currentStatus)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {currentStatusInfo && (
          <span
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ring-2 ring-offset-1 ring-current ${currentStatusInfo.color}`}
          >
            {currentStatusInfo.label}
          </span>
        )}
        {statuses
          .filter((s) => allowed.includes(s.value))
          .map((s) => (
            <button
              key={s.value}
              onClick={() => handleChange(s.value)}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-muted text-muted-foreground border-border hover:bg-muted/80 transition-colors disabled:opacity-70"
            >
              {saving ? "..." : `→ ${s.label}`}
            </button>
          ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
