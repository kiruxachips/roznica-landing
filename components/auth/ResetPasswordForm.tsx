"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { requestPasswordReset, resetPassword } from "@/lib/actions/auth"

type Step = "email" | "code" | "newPassword"

export function ResetPasswordForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleRequestCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const emailValue = form.get("email") as string
    setEmail(emailValue)

    await requestPasswordReset(emailValue)

    setLoading(false)
    setStep("code")
  }

  async function handleVerifyCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")

    const form = new FormData(e.currentTarget)
    setCode(form.get("code") as string)
    setStep("newPassword")
  }

  async function handleResetPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const newPassword = form.get("password") as string
    const confirm = form.get("confirmPassword") as string

    if (newPassword !== confirm) {
      setError("Пароли не совпадают")
      setLoading(false)
      return
    }

    if (newPassword.length < 6) {
      setError("Пароль должен быть не менее 6 символов")
      setLoading(false)
      return
    }

    const result = await resetPassword(email, code, newPassword)

    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    router.push("/auth/login?reset=1")
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8">
      <h1 className="text-2xl font-sans font-bold text-center mb-2">Восстановление пароля</h1>

      {step === "email" && (
        <>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Введите email, на который зарегистрирован аккаунт
          </p>
          <form onSubmit={handleRequestCode} className="space-y-4">
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

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Отправка..." : "Отправить код"}
            </button>
          </form>
        </>
      )}

      {step === "code" && (
        <>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Введите 6-значный код, отправленный на <span className="font-medium text-foreground">{email}</span>
          </p>
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div>
              <label htmlFor="code" className="block text-sm font-medium mb-1">
                Код
              </label>
              <input
                id="code"
                name="code"
                required
                maxLength={6}
                pattern="\d{6}"
                inputMode="numeric"
                className="w-full h-11 px-4 rounded-xl border border-input text-sm text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="000000"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              Подтвердить
            </button>
          </form>
        </>
      )}

      {step === "newPassword" && (
        <>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Придумайте новый пароль
          </p>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Новый пароль
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

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {loading ? "Сохранение..." : "Сохранить пароль"}
            </button>
          </form>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/auth/login" className="text-primary hover:underline">
          Вернуться к входу
        </Link>
      </p>
    </div>
  )
}
