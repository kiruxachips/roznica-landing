"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { confirmWholesalePasswordReset } from "@/lib/actions/wholesale-auth"

export function WholesalePasswordResetConfirmForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailFromQuery = searchParams.get("email") || ""
  const [error, setError] = useState("")
  const [ok, setOk] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    try {
      await confirmWholesalePasswordReset({
        email: String(form.get("email") || ""),
        code: String(form.get("code") || ""),
        newPassword: String(form.get("newPassword") || ""),
      })
      setOk(true)
      setTimeout(() => router.push("/wholesale/login"), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось установить пароль")
      setLoading(false)
    }
  }

  if (ok) {
    return (
      <div className="rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3">
        Пароль установлен. Перенаправляем на вход…
      </div>
    )
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
          defaultValue={emailFromQuery}
          required
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Код из письма</label>
        <input
          name="code"
          required
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Новый пароль (минимум 8 символов)</label>
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary text-primary-foreground font-medium py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? "Сохраняем..." : "Установить пароль"}
      </button>
    </form>
  )
}
