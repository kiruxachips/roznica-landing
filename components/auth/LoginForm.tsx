"use client"

import { useState, useEffect } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { OAuthButtons } from "./OAuthButtons"
import { TelegramLoginButton } from "./TelegramLoginButton"

// R5: ключ в localStorage для запоминания email (НЕ пароля — только email,
// чтобы не заставлять юзера вводить его повторно). Пароль приходит через
// password-manager или вводится руками.
const REMEMBER_EMAIL_KEY = "mc.remember_email"

// OAuth-ошибки, которые redirect-нули нас сюда с error=... параметром.
// Пары code → человеческое сообщение; неизвестный code → generic fallback.
const OAUTH_ERRORS: Record<string, string> = {
  vk_email_already_registered:
    "Этот email уже зарегистрирован другим способом. Войдите с паролем и подключите VK в настройках профиля.",
  vk_token_exchange: "Не удалось войти через VK. Попробуйте ещё раз.",
  vk_no_user_id: "VK не вернул ID пользователя. Попробуйте ещё раз.",
  vk_state_mismatch: "Истекла сессия входа. Попробуйте ещё раз.",
  vk_missing_params: "Неполный ответ от VK. Попробуйте ещё раз.",
  vk_missing_cookies: "Потерялись cookies сессии. Попробуйте ещё раз.",
  vk_unexpected: "Ошибка при входе через VK. Попробуйте ещё раз или войдите паролем.",
  vk_rate_limited: "Слишком много попыток входа через VK. Подождите несколько минут.",
}

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Pass-2-E: open-redirect защита. Принимаем только относительные пути,
  // начинающиеся с одного `/`. Двойной слэш `//evil.com` или абсолютный
  // `https://evil.com` отвергаем — иначе атакующий мог бы прислать ссылку
  // /auth/login?callbackUrl=https://phish.example и угнать сессию после
  // успешного логина.
  const rawCallback = searchParams.get("callbackUrl") || "/account"
  const callbackUrl =
    rawCallback.startsWith("/") && !rawCallback.startsWith("//")
      ? rawCallback
      : "/account"
  const verified = searchParams.get("verified")
  const oauthError = searchParams.get("error")
  const oauthErrorMessage = oauthError
    ? OAUTH_ERRORS[oauthError] || "Не удалось войти через внешний сервис. Попробуйте ещё раз."
    : null
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [rememberedEmail, setRememberedEmail] = useState("")
  const [remember, setRemember] = useState(true)

  // R5: восстанавливаем сохранённый email при загрузке формы. В default-value
  // это попасть не может (SSR), поэтому ставим после mount через key-based
  // re-render через controlled state — но используем uncontrolled input
  // с defaultValue, управляем через key.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY)
      if (saved) {
        setRememberedEmail(saved)
      } else {
        // Если email не сохранён, галочку снимаем (значит юзер явно отказался).
        setRemember(false)
      }
    } catch {
      /* localStorage недоступен — ок */
    }
  }, [])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const form = new FormData(e.currentTarget)

    const emailValue = form.get("email") as string
    const result = await signIn("customer-credentials", {
      email: emailValue,
      password: form.get("password") as string,
      redirect: false,
    })

    setLoading(false)

    if (result?.error) {
      setError("Неверный email или пароль")
    } else {
      // R5: при успешном входе сохраняем / чистим email в зависимости
      // от состояния галочки.
      try {
        if (remember && emailValue) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, emailValue.toLowerCase().trim())
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY)
        }
      } catch {
        /* no-op */
      }
      router.push(callbackUrl)
      router.refresh()
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-8">
      <h1 className="text-2xl font-sans font-bold text-center mb-6">Вход</h1>

      {verified === "1" && (
        <p className="text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3 mb-4 text-center">
          Email подтверждён! Войдите в аккаунт.
        </p>
      )}

      {oauthErrorMessage && (
        <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3 mb-4">
          {oauthErrorMessage}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            key={rememberedEmail}
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            enterKeyHint="next"
            autoFocus
            defaultValue={rememberedEmail}
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
            autoComplete="current-password"
            enterKeyHint="go"
            onKeyUp={(e) => setCapsLock(e.getModifierState?.("CapsLock") ?? false)}
            onBlur={() => setCapsLock(false)}
            className="w-full h-11 px-4 rounded-xl border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {capsLock && (
            <p className="mt-1 text-xs text-amber-700 flex items-center gap-1">
              <span aria-hidden>⚠</span> Включён Caps Lock
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          <span className="text-sm text-muted-foreground">Запомнить меня</span>
        </label>

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
