"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  approveWholesaleAccessRequest,
  rejectWholesaleAccessRequest,
} from "@/lib/actions/wholesale-requests"

interface Props {
  requestId: string
  priceLists: { id: string; name: string }[]
  managers: { id: string; name: string }[]
}

export function ApproveRequestPanel(props: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<"approve" | "reject" | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleApprove(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const form = new FormData(e.currentTarget)
    try {
      await approveWholesaleAccessRequest(props.requestId, {
        priceListId: (form.get("priceListId") as string) || null,
        paymentTerms: form.get("paymentTerms") as "prepay" | "net7" | "net14" | "net30" | "net60",
        creditLimit: Number(form.get("creditLimit") || 0),
        managerAdminId: (form.get("managerAdminId") as string) || null,
      })
      router.refresh()
      setMode(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось одобрить")
    } finally {
      setLoading(false)
    }
  }

  async function handleReject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const form = new FormData(e.currentTarget)
    try {
      await rejectWholesaleAccessRequest(props.requestId, String(form.get("note") || ""))
      router.refresh()
      setMode(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отклонить")
    } finally {
      setLoading(false)
    }
  }

  if (!mode) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-5 flex gap-3">
        <button
          onClick={() => setMode("approve")}
          className="rounded-lg bg-primary text-primary-foreground px-5 py-2.5 font-medium"
        >
          Одобрить
        </button>
        <button
          onClick={() => setMode("reject")}
          className="rounded-lg border border-red-200 text-red-700 px-5 py-2.5 font-medium hover:bg-red-50"
        >
          Отклонить
        </button>
      </div>
    )
  }

  if (mode === "approve") {
    return (
      <form onSubmit={handleApprove} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
        <h2 className="font-semibold">Параметры активации</h2>
        {error && (
          <div className="rounded bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
            {error}
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Прайс-лист</label>
            <select name="priceListId" className="w-full rounded-lg border border-border px-3 py-2 text-sm">
              <option value="">— Розничный (не назначать опт) —</option>
              {props.priceLists.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Условия оплаты</label>
            <select
              name="paymentTerms"
              defaultValue="prepay"
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            >
              <option value="prepay">Предоплата</option>
              <option value="net7">Отсрочка 7 дней</option>
              <option value="net14">Отсрочка 14 дней</option>
              <option value="net30">Отсрочка 30 дней</option>
              <option value="net60">Отсрочка 60 дней</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Кредитный лимит, ₽</label>
            <input
              type="number"
              name="creditLimit"
              defaultValue={0}
              min={0}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Ответственный менеджер</label>
            <select name="managerAdminId" className="w-full rounded-lg border border-border px-3 py-2 text-sm">
              <option value="">— Не назначен —</option>
              {props.managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary text-primary-foreground px-5 py-2.5 font-medium disabled:opacity-60"
          >
            {loading ? "Активируем..." : "Активировать доступ"}
          </button>
          <button
            type="button"
            onClick={() => setMode(null)}
            className="rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-muted"
          >
            Отмена
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={handleReject} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
      <h2 className="font-semibold">Отклонение заявки</h2>
      {error && (
        <div className="rounded bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">Комментарий клиенту</label>
        <textarea
          name="note"
          rows={3}
          className="w-full rounded-lg border border-border px-3 py-2 text-sm"
          placeholder="Причина отклонения (отправим клиенту)"
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-red-600 text-white px-5 py-2.5 font-medium disabled:opacity-60"
        >
          {loading ? "Отклоняем..." : "Отклонить"}
        </button>
        <button
          type="button"
          onClick={() => setMode(null)}
          className="rounded-lg border border-border px-5 py-2.5 font-medium hover:bg-muted"
        >
          Отмена
        </button>
      </div>
    </form>
  )
}
