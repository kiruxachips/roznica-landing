"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { registerUser } from "@/lib/actions/auth"
import { OAuthButtons } from "./OAuthButtons"

export function RegisterForm() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const password = form.get("password") as string
    const confirmPassword = form.get("confirmPassword") as string

    if (password !== confirmPassword) {
      setError("Пароли не совпадают")
      setLoading(false)
      return
    }

    // P2-2: 8 символов + буквы + цифры. Спец. символы не требуем, чтобы не
    // ломать UX юзерам со сложными менеджерами паролей, но элементарный
    // brute-force с 6 символов теперь не проходит.
    if (password.length < 8) {
      setError("Пароль должен быть не менее 8 символов")
      setLoading(false)
      return
    }
    if (!/[a-zA-Zа-яА-ЯёЁ]/.test(password) || !/\d/.test(password)) {
      setError("Пароль должен содержать хотя бы одну букву и одну цифру")
      setLoading(false)
      return
    }

    const result = await registerUser({
      email: form.get("email") as string,
      password,
      name: form.get("name") as string,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      router.push(`/auth/verify?email=${encodeURIComponent(form.get("email") as string)}`)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8">
      <h1 className="text-2xl font-sans font-bold text-center mb-6">Регистрация</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Имя
          </label>
          <input
            id="name"
            name="name"
            required
            className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Иван"
          />
        </div>

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
            minLength={6}
            className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
            Подтвердите пароль
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input accent-primary"
          />
          <span className="text-sm text-muted-foreground">
            Я соглашаюсь с{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Политикой конфиденциальности
            </Link>{" "}
            и{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Пользовательским соглашением
            </Link>
          </span>
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !agreed}
          className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {loading ? "Регистрация..." : "Зарегистрироваться"}
        </button>
      </form>

      <div className="mt-6">
        <OAuthButtons />
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Уже есть аккаунт?{" "}
        <Link href="/auth/login" className="text-primary hover:underline font-medium">
          Войти
        </Link>
      </p>
    </div>
  )
}
