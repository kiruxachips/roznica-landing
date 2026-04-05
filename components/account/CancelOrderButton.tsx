"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { cancelOrder } from "@/lib/actions/orders"

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleCancel() {
    if (!confirm("Вы уверены, что хотите отменить заказ?")) return

    setLoading(true)
    setError("")
    try {
      await cancelOrder(orderId)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка отмены")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleCancel}
        disabled={loading}
        className="px-4 py-2 text-sm rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {loading ? "Отмена..." : "Отменить заказ"}
      </button>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  )
}
