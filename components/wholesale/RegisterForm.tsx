"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { submitWholesaleAccessRequest } from "@/lib/actions/wholesale-requests"

export function WholesaleRegisterForm() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const form = new FormData(e.currentTarget)
    try {
      await submitWholesaleAccessRequest({
        legalName: String(form.get("legalName") || ""),
        inn: String(form.get("inn") || ""),
        contactName: String(form.get("contactName") || ""),
        contactPhone: String(form.get("contactPhone") || ""),
        contactEmail: String(form.get("contactEmail") || ""),
        expectedVolume: String(form.get("expectedVolume") || "").trim() || undefined,
        comment: String(form.get("comment") || "").trim() || undefined,
      })
      router.push("/wholesale/register/success")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить заявку")
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
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Полное название юрлица</label>
          <input
            name="legalName"
            required
            placeholder='ООО "Ромашка"'
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">ИНН</label>
          <input
            name="inn"
            required
            inputMode="numeric"
            pattern="\d{10}|\d{12}"
            title="10 или 12 цифр"
            placeholder="7701234567"
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Контактный телефон</label>
          <input
            name="contactPhone"
            required
            type="tel"
            placeholder="+7 900 000-00-00"
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Контактное лицо</label>
          <input
            name="contactName"
            required
            placeholder="Иван Иванов"
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">Email</label>
          <input
            name="contactEmail"
            required
            type="email"
            placeholder="buyer@example.com"
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium mb-1.5 block">
            Ожидаемый объём закупок <span className="text-muted-foreground">(необязательно)</span>
          </label>
          <input
            name="expectedVolume"
            placeholder="~500 кг в месяц"
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium mb-1.5 block">
            Комментарий <span className="text-muted-foreground">(необязательно)</span>
          </label>
          <textarea
            name="comment"
            rows={3}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full sm:w-auto rounded-xl bg-primary text-primary-foreground font-medium px-6 py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? "Отправляем..." : "Отправить заявку"}
      </button>
    </form>
  )
}
