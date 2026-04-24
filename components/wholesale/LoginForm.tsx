"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

export function WholesaleLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/wholesale"
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const result = await signIn("wholesale-credentials", {
      email: form.get("email") as string,
      password: form.get("password") as string,
      redirect: false,
    })
    setLoading(false)

    if (result?.error) {
      // next-auth возвращает либо CredentialsSignin для неверных, либо текст нашей AuthError
      setError(
        result.error === "CredentialsSignin"
          ? "Неверный email или пароль"
          : "Не удалось войти. Проверьте данные или свяжитесь с менеджером."
      )
      return
    }
    router.push(callbackUrl)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="text-sm font-medium text-foreground mb-1.5 block">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-foreground mb-1.5 block">
          Пароль
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary text-primary-foreground font-medium py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? "Входим..." : "Войти"}
      </button>
      <div className="text-center text-xs text-muted-foreground">
        <Link href="/wholesale/password/reset" className="hover:text-foreground underline-offset-2 hover:underline">
          Забыли пароль?
        </Link>
      </div>
    </form>
  )
}
