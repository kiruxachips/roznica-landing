"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { X } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const COOKIE_CONSENT_KEY = "millor-cookie-consent"

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!consent) {
      setIsVisible(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted")
    setIsVisible(false)
  }

  const handleDecline = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "declined")
    setIsVisible(false)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-border p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Text */}
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-1">
              Мы используем cookies
            </h3>
            <p className="text-sm text-muted-foreground">
              Мы используем файлы cookie и сервисы аналитики (Яндекс.Метрика, Вебвизор) для улучшения работы сайта
              и анализа посещаемости. Продолжая использовать сайт, вы соглашаетесь с{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Политикой конфиденциальности
              </Link>{" "}
              и{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Пользовательским соглашением
              </Link>.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleDecline}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
            >
              Отклонить
            </button>
            <button
              onClick={handleAccept}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Принять
            </button>
          </div>

          {/* Close button for mobile */}
          <button
            onClick={handleDecline}
            className="absolute top-3 right-3 sm:hidden p-1 text-muted-foreground hover:text-foreground"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
