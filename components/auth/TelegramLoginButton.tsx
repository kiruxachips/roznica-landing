"use client"

import { useEffect, useRef } from "react"
import { signIn } from "next-auth/react"

export function TelegramLoginButton() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Expose callback globally for Telegram widget
    const win = window as unknown as Record<string, unknown>
    win.onTelegramAuth = async (user: Record<string, unknown>) => {
      await signIn("telegram", {
        telegramData: JSON.stringify(user),
        callbackUrl: "/account",
      })
    }

    const script = document.createElement("script")
    script.src = "https://telegram.org/js/telegram-widget.js?22"
    script.setAttribute("data-telegram-login", process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "")
    script.setAttribute("data-size", "large")
    script.setAttribute("data-radius", "12")
    script.setAttribute("data-onauth", "onTelegramAuth(user)")
    script.setAttribute("data-request-access", "write")
    script.async = true

    containerRef.current.appendChild(script)

    return () => {
      delete win.onTelegramAuth
    }
  }, [])

  if (!process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME) return null

  return <div ref={containerRef} className="flex justify-center" />
}
