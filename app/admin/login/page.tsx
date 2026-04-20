"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

export default function AdminLoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const formData = new FormData(e.currentTarget)

    const result = await signIn("admin-credentials", {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      // NextAuth v5 возвращает code=CredentialsSignin даже для конкретных ошибок из authorize.
      // Сопоставляем распространённые причины вручную.
      const msg = String(result.error)
      if (msg.includes("одобр")) setError("Аккаунт ожидает одобрения администратором")
      else if (msg.includes("блок")) setError("Аккаунт заблокирован. Обратитесь к администратору")
      else setError("Неверный email или пароль")
    } else {
      router.push("/admin")
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex justify-center mb-6">
            <Image src="/images/logo.webp" alt="Millor Coffee" width={125} height={50} />
          </div>
          <h1 className="text-xl font-semibold text-center mb-6">Вход в админ-панель</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-muted-foreground mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="admin@millor-coffee.ru"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-muted-foreground mb-1">
                Пароль
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
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
              {loading ? "Вход..." : "Войти"}
            </button>

            <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border">
              Новый менеджер?{" "}
              <Link href="/admin/register" className="text-primary hover:underline font-medium">
                Запросить доступ
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
