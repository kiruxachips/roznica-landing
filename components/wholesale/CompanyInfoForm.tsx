"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { submitCompanyInfo } from "@/lib/actions/wholesale-signup"

interface DadataSuggestion {
  value: string
  inn?: string
  kpp?: string
  ogrn?: string
  address?: string
  status?: string
}

interface CompanyState {
  legalName: string
  inn: string
  kpp: string
  ogrn: string
  legalAddress: string
  bankName: string
  bankAccount: string
  bankBic: string
  corrAccount: string
  status: string
}

export function CompanyInfoForm({ company }: { company: CompanyState }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [values, setValues] = useState(company)
  const [suggestions, setSuggestions] = useState<DadataSuggestion[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // DaData автозаполнение по названию/ИНН
  useEffect(() => {
    const q =
      values.inn.replace(/\D/g, "").length >= 5
        ? values.inn
        : values.legalName.length >= 3
          ? values.legalName
          : ""
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
      } catch {}
    }, 300)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [values.inn, values.legalName])

  function applySuggestion(s: DadataSuggestion) {
    setValues((v) => ({
      ...v,
      legalName: s.value || v.legalName,
      inn: s.inn || v.inn,
      kpp: s.kpp || v.kpp,
      ogrn: s.ogrn || v.ogrn,
      legalAddress: s.address || v.legalAddress,
    }))
    setSuggestions([])
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      await submitCompanyInfo({
        legalName: values.legalName,
        inn: values.inn,
        kpp: values.kpp || undefined,
        ogrn: values.ogrn || undefined,
        legalAddress: values.legalAddress || undefined,
        bankName: values.bankName || undefined,
        bankAccount: values.bankAccount || undefined,
        bankBic: values.bankBic || undefined,
        corrAccount: values.corrAccount || undefined,
      })
      router.push("/wholesale")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения")
      setLoading(false)
    }
  }

  // Реквизиты можно редактировать в любой момент. Менеджер видит изменения
  // в админке и при необходимости пересогласует отсрочку/лимит.
  const readonly = false

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}


      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 relative">
          <label className="text-sm font-medium mb-1.5 block">Полное название</label>
          <input
            value={values.legalName}
            onChange={(e) => setValues((v) => ({ ...v, legalName: e.target.value }))}
            placeholder='ООО "Ромашка" или ИП Иванов И.И.'
            required
            disabled={readonly}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm disabled:bg-muted/40"
          />
          {suggestions.length > 0 && !readonly && (
            <ul className="absolute z-10 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-border max-h-60 overflow-y-auto">
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
            value={values.inn}
            onChange={(e) => setValues((v) => ({ ...v, inn: e.target.value.replace(/\D/g, "") }))}
            required
            inputMode="numeric"
            pattern="\d{10}|\d{12}"
            disabled={readonly}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm disabled:bg-muted/40"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">КПП (если ООО)</label>
          <input
            value={values.kpp}
            onChange={(e) => setValues((v) => ({ ...v, kpp: e.target.value }))}
            disabled={readonly}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm disabled:bg-muted/40"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block">ОГРН / ОГРНИП</label>
          <input
            value={values.ogrn}
            onChange={(e) => setValues((v) => ({ ...v, ogrn: e.target.value }))}
            disabled={readonly}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm disabled:bg-muted/40"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-sm font-medium mb-1.5 block">Юридический адрес</label>
          <input
            value={values.legalAddress}
            onChange={(e) => setValues((v) => ({ ...v, legalAddress: e.target.value }))}
            disabled={readonly}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm disabled:bg-muted/40"
          />
        </div>
      </div>

      <div className="pt-3 border-t">
        <h3 className="font-semibold text-sm mb-3">Банковские реквизиты (для счетов)</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Название банка</label>
            <input
              value={values.bankName}
              onChange={(e) => setValues((v) => ({ ...v, bankName: e.target.value }))}
              disabled={readonly}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm disabled:bg-muted/40"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Расчётный счёт</label>
            <input
              value={values.bankAccount}
              onChange={(e) => setValues((v) => ({ ...v, bankAccount: e.target.value }))}
              disabled={readonly}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm disabled:bg-muted/40"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">БИК</label>
            <input
              value={values.bankBic}
              onChange={(e) => setValues((v) => ({ ...v, bankBic: e.target.value }))}
              disabled={readonly}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm disabled:bg-muted/40"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium mb-1.5 block">Корр. счёт</label>
            <input
              value={values.corrAccount}
              onChange={(e) => setValues((v) => ({ ...v, corrAccount: e.target.value }))}
              disabled={readonly}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm disabled:bg-muted/40"
            />
          </div>
        </div>
      </div>

      {!readonly && (
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto rounded-xl bg-primary text-primary-foreground font-medium px-6 py-2.5 hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? "Сохраняем..." : "Отправить на проверку"}
        </button>
      )}
    </form>
  )
}
