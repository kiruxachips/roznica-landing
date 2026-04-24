"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { signupWholesaleSelfService } from "@/lib/actions/wholesale-signup"

export function WholesaleRegisterForm() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    const email = String(form.get("email") || "")
    const password = String(form.get("password") || "")
    try {
      await signupWholesaleSelfService({
        email,
        password,
        name: String(form.get("name") || ""),
        phone: String(form.get("phone") || ""),
        companyName: String(form.get("companyName") || "").trim() || undefined,
      })
      // Auto-login
      const result = await signIn("wholesale-credentials", {
        email,
        password,
        redirect: false,
      })
      if (result?.error) {
        router.push("/wholesale/login")
        return
      }
      router.push("/wholesale")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось зарегистрироваться")
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

      <div className="rounded-xl bg-primary/5 border border-primary/20 text-sm p-3">
        Регистрация в 1 шаг — ИНН и реквизиты заполните потом в кабинете, когда будете готовы
        сделать первый заказ.
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Ваше имя</label>
          <input
            name="name"
            required
            placeholder="Иван Иванов"
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Рабочий email</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Телефон</label>
          <input
            name="phone"
            type="tel"
            required
            placeholder="+7 900 000-00-00"
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
        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Название компании <span className="text-muted-foreground">(если знаете)</span>
          </label>
          <input
            name="companyName"
            placeholder='Например, ООО "Ромашка" или кофейня "Тёплый кофе"'
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto rounded-xl bg-primary text-primary-foreground font-medium px-6 py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? "Создаём кабинет..." : "Зарегистрироваться"}
      </button>

      <p className="text-xs text-muted-foreground">
        Регистрируясь, вы соглашаетесь с{" "}
        <a href="/terms" className="underline">условиями использования</a> и{" "}
        <a href="/privacy" className="underline">политикой обработки данных</a>.
      </p>
    </form>
  )
}
