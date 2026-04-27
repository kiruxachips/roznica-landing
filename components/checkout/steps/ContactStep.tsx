"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { PhoneInput } from "@/components/ui/phone-input"
import { useCheckoutWizard } from "@/lib/store/checkout-wizard"
import { ArrowRight } from "lucide-react"

// Частые опечатки доменов email. Показываем ненавязчивую подсказку
// «Вы имели в виду kirill@gmail.com?» — кликом заменяет поле.
const EMAIL_TYPO_FIXES: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.ru": "gmail.com",
  "yandex.com": "yandex.ru",
  "yandx.ru": "yandex.ru",
  "yandex.ur": "yandex.ru",
  "ya.com": "ya.ru",
  "mail.r": "mail.ru",
  "mil.ru": "mail.ru",
  "mial.ru": "mail.ru",
  "rambler.com": "rambler.ru",
  "outlok.com": "outlook.com",
  "hotmial.com": "hotmail.com",
}

function suggestEmail(email: string): string | null {
  const at = email.lastIndexOf("@")
  if (at < 1 || at === email.length - 1) return null
  const local = email.slice(0, at)
  const domain = email.slice(at + 1).toLowerCase().trim()
  const fix = EMAIL_TYPO_FIXES[domain]
  if (!fix || fix === domain) return null
  return `${local}@${fix}`
}

interface UserProfile {
  name: string | null
  email: string | null
  phone: string | null
}

export function ContactStep() {
  const { data: session } = useSession()
  const contact = useCheckoutWizard((s) => s.contact)
  const setContact = useCheckoutWizard((s) => s.setContact)
  const markCompleted = useCheckoutWizard((s) => s.markCompleted)
  const setStep = useCheckoutWizard((s) => s.setStep)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [profile, setProfile] = useState<UserProfile | null>(null)
  // Подсказка-опечатка вычисляется на onBlur, а не при каждом нажатии —
  // иначе во время ввода "test@gmi" подсказка мерцала бы вкл/выкл.
  const [emailTypoFix, setEmailTypoFix] = useState<string | null>(null)
  // I8: ref для AbortController track-abandoned запроса.
  const trackAbortRef = useRef<AbortController | null>(null)
  const isCustomer = (session?.user as Record<string, unknown>)?.userType === "customer"

  useEffect(() => {
    if (!isCustomer || !session?.user?.id) return
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: UserProfile | null) => {
        if (!data) return
        setProfile(data)
        // Автозаполнение профилем — только если поле в сторе пустое
        // (юзер мог уже что-то ввести).
        const parts = data.name?.trim().split(" ") || []
        const nextEmail = contact.email || data.email || ""
        setContact({
          firstName: contact.firstName || parts[0] || "",
          lastName: contact.lastName || parts.slice(1).join(" ") || "",
          email: nextEmail,
          phone: contact.phone || data.phone || "",
        })
        // Если профильный email содержит типичную опечатку — сразу
        // показываем подсказку, иначе юзер её никогда не увидит
        // (suggest триггерится только на onBlur ручного ввода).
        if (nextEmail) setEmailTypoFix(suggestEmail(nextEmail))
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCustomer, session?.user?.id])

  function validate(): boolean {
    const e: Record<string, string> = {}
    if (!contact.lastName.trim()) e.lastName = "Укажите фамилию"
    if (!contact.firstName.trim()) e.firstName = "Укажите имя"
    if (!contact.phone.trim()) {
      e.phone = "Укажите телефон"
    } else {
      const digits = contact.phone.replace(/\D/g, "")
      if (!/^[78]\d{10}$/.test(digits)) {
        e.phone = "Введите корректный номер, например +7 (999) 123-45-67"
      }
    }
    // C9: убираем дыры старого regex (`t@.com`, `t@gmail.c` проходили).
    // Требуем доменную часть ≥2 символов до точки и TLD ≥2 латинских букв.
    // Не пытаемся быть RFC-полными — это покрывает 99% реальных багов
    // ввода, не отрезая валидные адреса.
    if (
      contact.email.trim() &&
      !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-zA-Z]{2,}$/.test(contact.email.trim())
    ) {
      e.email = "Проверьте email"
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleNext() {
    if (!validate()) return
    markCompleted("contact")
    setStep("delivery")
  }

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 lg:p-8 shadow-sm space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Контактные данные</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Нужны чтобы связаться по заказу
        </p>
      </div>

      {isCustomer && profile && (
        <p className="text-sm text-muted-foreground bg-primary/5 rounded-xl px-4 py-2">
          Данные заполнены из вашего профиля
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Фамилия *</label>
          <input
            autoComplete="family-name"
            autoCapitalize="words"
            value={contact.lastName}
            onChange={(e) => {
              setContact({ lastName: e.target.value })
              if (errors.lastName) setErrors((s) => ({ ...s, lastName: "" }))
            }}
            className={`w-full h-11 px-4 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.lastName ? "border-red-400" : "border-input"
            }`}
            placeholder="Иванов"
          />
          {errors.lastName && <p className="text-xs text-red-600 mt-1">{errors.lastName}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Имя *</label>
          <input
            autoComplete="given-name"
            autoCapitalize="words"
            value={contact.firstName}
            onChange={(e) => {
              setContact({ firstName: e.target.value })
              if (errors.firstName) setErrors((s) => ({ ...s, firstName: "" }))
            }}
            className={`w-full h-11 px-4 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.firstName ? "border-red-400" : "border-input"
            }`}
            placeholder="Иван"
          />
          {errors.firstName && <p className="text-xs text-red-600 mt-1">{errors.firstName}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Телефон *</label>
          <PhoneInput
            value={contact.phone}
            onChange={(value) => {
              setContact({ phone: value })
              if (errors.phone) setErrors((s) => ({ ...s, phone: "" }))
            }}
            className={`w-full h-11 px-4 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.phone ? "border-red-400" : "border-input"
            }`}
          />
          {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            value={contact.email}
            onChange={(e) => {
              setContact({ email: e.target.value })
              if (errors.email) setErrors((s) => ({ ...s, email: "" }))
              if (emailTypoFix) setEmailTypoFix(null)
            }}
            onBlur={(e) => {
              setEmailTypoFix(suggestEmail(contact.email))
              // G3: track abandoned cart — как только юзер ввёл валидный email
              // на первом шаге и корзина не пустая.
              // I8: AbortController прерывает старый запрос если юзер быстро
              // меняет email и blur срабатывает повторно. Иначе бэкенд
              // получает дубли и может race'ить запись abandoned-cart.
              const value = e.target.value.trim().toLowerCase()
              if (
                value &&
                /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-zA-Z]{2,}$/.test(value)
              ) {
                trackAbortRef.current?.abort()
                const ctrl = new AbortController()
                trackAbortRef.current = ctrl
                import("@/lib/store/cart").then(({ useCartStore }) => {
                  const items = useCartStore.getState().items
                  if (items.length === 0) return
                  fetch("/api/cart/track-abandoned", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: value, items }),
                    signal: ctrl.signal,
                  }).catch(() => {})
                })
              }
            }}
            className={`w-full h-11 px-4 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
              errors.email ? "border-red-400" : "border-input"
            }`}
            placeholder="email@example.com"
          />
          {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
          {!errors.email && emailTypoFix && (
            <p className="text-xs mt-1" aria-live="polite" aria-atomic="true">
              <span className="text-muted-foreground">Возможно, вы имели в виду </span>
              <button
                type="button"
                onClick={() => {
                  setContact({ email: emailTypoFix })
                  setEmailTypoFix(null)
                }}
                className="text-primary hover:underline font-medium"
              >
                {emailTypoFix}
              </button>
              <span className="text-muted-foreground">?</span>
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleNext}
        className="w-full h-12 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        Продолжить к доставке
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  )
}
