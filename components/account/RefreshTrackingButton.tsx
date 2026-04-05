"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"

export function RefreshTrackingButton({ orderId }: { orderId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRefresh() {
    setLoading(true)
    try {
      await fetch("/api/orders/refresh-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })
      router.refresh()
    } catch {
      // silent fail — page will just show old status
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
      title="Обновить статус доставки"
    >
      <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Обновление..." : "Обновить"}
    </button>
  )
}
