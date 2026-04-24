"use client"

import { useState } from "react"
import { Send, Check } from "lucide-react"
import { subscribeToNewsletter } from "@/lib/actions/newsletter"

export function NewsletterForm() {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "loading" | "ok" | "already" | "error">("idle")
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState("loading")
    setError("")
    try {
      const res = await subscribeToNewsletter(email, ["promotions", "new_products"], "footer_form")
      if (!res.ok) {
        setError(res.error || "Не удалось подписаться")
        setState("error")
        return
      }
      setState(res.alreadySubscribed ? "already" : "ok")
      setEmail("")
    } catch {
      setError("Сетевая ошибка, попробуйте позже")
      setState("error")
    }
  }

  if (state === "ok" || state === "already") {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-300 bg-white/5 rounded-xl px-3 py-2.5 border border-white/10">
        <Check className="w-4 h-4" />
        {state === "ok" ? "Готово! Добавили вас в список." : "Вы уже подписаны, спасибо!"}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="email"
          required
          aria-label="Email для подписки на рассылку"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="flex-1 h-10 px-3 rounded-xl bg-white/10 border border-white/20 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={state === "loading"}
        />
        <button
          type="submit"
          disabled={state === "loading" || !email}
          aria-label="Подписаться на рассылку"
          className="h-10 px-4 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-medium flex items-center gap-1.5 transition-colors disabled:opacity-60"
        >
          <Send className="w-4 h-4" />
          {state === "loading" ? "…" : "Подписаться"}
        </button>
      </div>
      {error && (
        <p role="alert" aria-live="polite" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </form>
  )
}
