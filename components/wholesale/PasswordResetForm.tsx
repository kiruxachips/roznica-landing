"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { requestWholesalePasswordReset } from "@/lib/actions/wholesale-auth"

export function WholesalePasswordResetForm() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const email = String(form.get("email") || "")
    try {
      await requestWholesalePasswordReset(email)
      router.push(`/wholesale/password/reset/confirm?email=${encodeURIComponent(email)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить запрос")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}
      <div>
        <label className="text-sm font-medium mb-1.5 block">Email</label>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary text-primary-foreground font-medium py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? "Отправляем..." : "Отправить код"}
      </button>
    </form>
  )
}
