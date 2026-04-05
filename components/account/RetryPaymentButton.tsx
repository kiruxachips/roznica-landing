"use client"

import { useState } from "react"
import { CreditCard } from "lucide-react"
import { retryPayment } from "@/lib/actions/orders"

export function RetryPaymentButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleClick() {
    setLoading(true)
    setError("")
    try {
      const paymentUrl = await retryPayment(orderId)
      window.location.href = paymentUrl
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка при создании платежа")
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        <CreditCard className="w-4 h-4" />
        {loading ? "Подождите..." : "Оплатить заказ"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
