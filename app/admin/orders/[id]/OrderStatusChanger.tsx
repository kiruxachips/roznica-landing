"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { updateOrderStatus } from "@/lib/actions/orders"

const statuses = [
  { value: "pending", label: "Новый", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { value: "confirmed", label: "Подтверждён", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { value: "shipped", label: "Отправлен", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { value: "delivered", label: "Доставлен", color: "bg-green-50 text-green-700 border-green-200" },
  { value: "cancelled", label: "Отменён", color: "bg-red-50 text-red-700 border-red-200" },
]

export function OrderStatusChanger({ orderId, currentStatus }: { orderId: string; currentStatus: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  async function handleChange(status: string) {
    setSaving(true)
    try {
      await updateOrderStatus(orderId, status)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((s) => (
        <button
          key={s.value}
          onClick={() => handleChange(s.value)}
          disabled={saving || s.value === currentStatus}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-70 ${
            s.value === currentStatus ? `${s.color} ring-2 ring-offset-1 ring-current` : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
