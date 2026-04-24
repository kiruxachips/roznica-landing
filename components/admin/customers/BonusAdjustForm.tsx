"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { adjustCustomerBonuses } from "@/lib/actions/customers"

export function BonusAdjustForm({
  userId,
  currentBalance,
}: {
  userId: string
  currentBalance: number
}) {
  const router = useRouter()
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const amt = parseInt(amount, 10)
    if (Number.isNaN(amt) || amt === 0) {
      setError("Введите число ≠ 0")
      return
    }
    if (!reason.trim()) {
      setError("Укажите причину")
      return
    }
    setLoading(true)
    setError("")
    setMessage("")
    try {
      const res = await adjustCustomerBonuses(userId, amt, reason)
      if (!res.ok) {
        setError(res.error || "Ошибка")
      } else {
        setMessage(`Баланс обновлён: ${res.newBalance}₽`)
        setAmount("")
        setReason("")
        router.refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Изменение, ₽</label>
        <input
          type="number"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="+500 или -200"
          className="h-9 px-3 rounded-lg border border-border text-sm w-32"
        />
      </div>
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs text-muted-foreground mb-1">Причина *</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Например: компенсация за задержку"
          className="w-full h-9 px-3 rounded-lg border border-border text-sm"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-60"
      >
        {loading ? "…" : "Применить"}
      </button>
      {error && (
        <p className="w-full text-xs text-red-700 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
      )}
      {message && (
        <p className="w-full text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
          {message} (было {currentBalance}₽)
        </p>
      )}
    </form>
  )
}
