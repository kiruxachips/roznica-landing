"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { submitWholesaleAccessRequest } from "@/lib/actions/wholesale-requests"

interface DadataSuggestion {
  value: string
  inn?: string
  kpp?: string
  ogrn?: string
  address?: string
  status?: string
}

export function WholesaleRegisterForm() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [legalName, setLegalName] = useState("")
  const [inn, setInn] = useState("")
  const [suggestions, setSuggestions] = useState<DadataSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const q = legalName.trim().length >= 3 ? legalName : inn.replace(/\D/g, "").length >= 5 ? inn : ""
    if (!q) {
      setSuggestions([])
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/wholesale/dadata?q=${encodeURIComponent(q)}`)
        if (!res.ok) return
        const data = (await res.json()) as { suggestions: DadataSuggestion[] }
        setSuggestions(data.suggestions ?? [])
      } catch {
        // Тихо — DaData не обязательна для работы формы
      }
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [legalName, inn])

  function applySuggestion(s: DadataSuggestion) {
    setLegalName(s.value)
    if (s.inn) setInn(s.inn)
    setShowSuggestions(false)
  }

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
        <div className="sm:col-span-2 relative">
          <label className="text-sm font-medium mb-1.5 block">Полное название юрлица</label>
          <input
            name="legalName"
            required
            placeholder='ООО "Ромашка"'
            value={legalName}
            onChange={(e) => {
              setLegalName(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-border max-h-64 overflow-y-auto">
              {suggestions.map((s, i) => (
                <li
                  key={i}
                  onMouseDown={() => applySuggestion(s)}
                  className="px-4 py-2 text-sm cursor-pointer hover:bg-muted"
                >
                  <div className="font-medium">{s.value}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.inn && `ИНН ${s.inn}`}
                    {s.address && ` · ${s.address}`}
                    {s.status && s.status !== "ACTIVE" && (
                      <span className="ml-1 text-red-600">({s.status})</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
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
            value={inn}
            onChange={(e) => {
              setInn(e.target.value)
              setShowSuggestions(true)
            }}
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
