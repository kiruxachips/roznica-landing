"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { acceptWholesaleInvitation } from "@/lib/actions/wholesale-members"

export function InviteAcceptForm({ token, email }: { token: string; email: string }) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const form = new FormData(e.currentTarget)
    const password = String(form.get("password") || "")
    try {
      await acceptWholesaleInvitation({
        token,
        password,
        name: String(form.get("name") || "") || undefined,
      })
      // Auto-login
      const result = await signIn("wholesale-credentials", {
        email,
        password,
        redirect: false,
      })
      if (result?.error) {
        router.push("/wholesale/login")
      } else {
        router.push("/wholesale")
        router.refresh()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка активации")
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
        <label className="text-sm font-medium mb-1.5 block">Ваше имя (если нужно уточнить)</label>
        <input
          name="name"
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Пароль (минимум 8 символов)</label>
        <input
          name="password"
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
        {loading ? "Активируем..." : "Принять приглашение и войти"}
      </button>
    </form>
  )
}
