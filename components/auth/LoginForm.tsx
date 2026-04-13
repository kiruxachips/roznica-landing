"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { OAuthButtons } from "./OAuthButtons"
import { TelegramLoginButton } from "./TelegramLoginButton"

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/account"
  const verified = searchParams.get("verified")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const form = new FormData(e.currentTarget)

    const result = await signIn("customer-credentials", {
      email: form.get("email") as string,
      password: form.get("password") as string,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("Неверный email или пароль")
    } else {
      router.push(callbackUrl)
      router.refresh()
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8">
      <h1 className="text-2xl font-serif font-bold text-center mb-6">Вход</h1>

      {verified === "1" && (
        <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3 mb-4 text-center">
          Email подтверждён! Войдите в аккаунт.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="email@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-1">
            Пароль
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>

      <div className="mt-4 text-center text-sm">
        <Link href="/auth/reset-password" className="text-primary hover:underline">
          Забыли пароль?
        </Link>
      </div>

      <div className="mt-6">
        <OAuthButtons />
      </div>

      <div className="mt-4">
        <TelegramLoginButton />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Нет аккаунта?{" "}
        <Link href="/auth/register" className="text-primary hover:underline font-medium">
          Зарегистрироваться
        </Link>
      </p>
    </div>
  )
}
