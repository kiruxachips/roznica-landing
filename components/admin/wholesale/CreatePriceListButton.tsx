"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createPriceList } from "@/lib/actions/wholesale-price-lists"

export function CreatePriceListButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const form = new FormData(e.currentTarget)
    try {
      const created = await createPriceList({
        name: String(form.get("name") || ""),
        description: (form.get("description") as string) || undefined,
        kind: form.get("kind") as "fixed" | "discount_pct",
        discountPct: Number(form.get("discountPct") || 0) || null,
        minOrderSum: Number(form.get("minOrderSum") || 0) || null,
      })
      router.push(`/admin/wholesale/price-lists/${created.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
      >
        + Создать прайс-лист
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="font-semibold text-lg">Новый прайс-лист</h2>
        {error && (
          <div className="rounded bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Название</label>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Тип</label>
          <select name="kind" className="w-full rounded-lg border border-border px-3 py-2 text-sm">
            <option value="fixed">Фиксированные цены (указываем вручную)</option>
            <option value="discount_pct">Процент скидки от розницы</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">% скидки (для типа «discount_pct»)</label>
          <input
            name="discountPct"
            type="number"
            min={1}
            max={99}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Мин. сумма заказа, ₽ (опционально)</label>
          <input
            name="minOrderSum"
            type="number"
            min={0}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Описание (опционально)</label>
          <textarea
            name="description"
            rows={2}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 font-medium disabled:opacity-60"
          >
            {loading ? "..." : "Создать"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex-1 rounded-lg border border-border py-2 font-medium hover:bg-muted"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  )
}
