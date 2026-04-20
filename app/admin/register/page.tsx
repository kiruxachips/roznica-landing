"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { registerManagerAction } from "./actions"

export default function AdminRegisterPage() {
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    const email = (fd.get("email") as string).toLowerCase().trim()
    const name = (fd.get("name") as string).trim()
    const password = fd.get("password") as string
    const password2 = fd.get("password2") as string

    if (password !== password2) {
      setError("Пароли не совпадают")
      setLoading(false)
      return
    }
    if (password.length < 8) {
      setError("Пароль должен быть не короче 8 символов")
      setLoading(false)
      return
    }

    const result = await registerManagerAction({ email, name, password })
    setLoading(false)
    if (result.success) {
      setSuccess(true)
    } else {
      setError(result.error || "Ошибка регистрации")
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
            <div className="flex justify-center">
              <Image src="/images/logo.webp" alt="Millor Coffee" width={125} height={50} />
            </div>
            <h1 className="text-xl font-semibold">Заявка отправлена</h1>
            <p className="text-sm text-muted-foreground">
              Администратор рассмотрит вашу заявку. После одобрения вы сможете войти по указанному email.
            </p>
            <Link
              href="/admin/login"
              className="inline-block text-primary hover:underline text-sm font-medium"
            >
              Вернуться на страницу входа
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex justify-center mb-6">
            <Image src="/images/logo.webp" alt="Millor Coffee" width={125} height={50} />
          </div>
          <h1 className="text-xl font-semibold text-center mb-1">Регистрация менеджера</h1>
          <p className="text-xs text-muted-foreground text-center mb-6">
            Заявка отправляется администратору на одобрение
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Имя</label>
              <input
                name="name"
                type="text"
                required
                minLength={2}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Иван Петров"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Email</label>
              <input
                name="email"
                type="email"
                required
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="manager@millor-coffee.ru"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Пароль (минимум 8 символов)
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                Повторите пароль
              </label>
              <input
                name="password2"
                type="password"
                required
                minLength={8}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Отправка..." : "Подать заявку"}
            </button>

            <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
              Уже есть доступ?{" "}
              <Link href="/admin/login" className="text-primary hover:underline font-medium">
                Войти
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
