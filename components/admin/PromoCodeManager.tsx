"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2 } from "lucide-react"
import { createPromoCode, updatePromoCode, deletePromoCode, togglePromoCodeActive } from "@/lib/actions/promo-codes"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"

interface PromoCodeData {
  id: string
  name: string
  comment: string | null
  code: string
  type: "percent" | "fixed"
  value: number
  startDate: string
  endDate: string
  usageCount: number
  maxUsage: number | null
  minOrderSum: number | null
  isActive: boolean
}

type FormData = {
  name: string
  comment: string
  code: string
  type: "percent" | "fixed"
  value: string
  startDate: string
  endDate: string
  maxUsage: string
  minOrderSum: string
}

const emptyForm: FormData = {
  name: "",
  comment: "",
  code: "",
  type: "percent",
  value: "",
  startDate: "",
  endDate: "",
  maxUsage: "",
  minOrderSum: "",
}

function toLocalDatetime(iso: string) {
  return new Date(iso).toISOString().slice(0, 16)
}

function getStatus(promo: PromoCodeData): { label: string; color: string } {
  if (!promo.isActive) return { label: "Выключен", color: "bg-red-100 text-red-700" }
  const now = new Date()
  const start = new Date(promo.startDate)
  const end = new Date(promo.endDate)
  if (now < start) return { label: "Запланирован", color: "bg-blue-100 text-blue-700" }
  if (now > end) return { label: "Истёк", color: "bg-gray-100 text-gray-600" }
  return { label: "Активен", color: "bg-green-100 text-green-700" }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })
}

export function PromoCodeManager({ promoCodes }: { promoCodes: PromoCodeData[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [togglingId, setTogglingId] = useState<string | null>(null)

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setError("")
    setShowForm(true)
  }

  function openEdit(promo: PromoCodeData) {
    setEditingId(promo.id)
    setForm({
      name: promo.name,
      comment: promo.comment || "",
      code: promo.code,
      type: promo.type,
      value: String(promo.value),
      startDate: toLocalDatetime(promo.startDate),
      endDate: toLocalDatetime(promo.endDate),
      maxUsage: promo.maxUsage !== null ? String(promo.maxUsage) : "",
      minOrderSum: promo.minOrderSum !== null ? String(promo.minOrderSum) : "",
    })
    setError("")
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError("")

    try {
      const payload = {
        name: form.name,
        comment: form.comment || undefined,
        code: form.code,
        type: form.type,
        value: parseInt(form.value),
        startDate: form.startDate,
        endDate: form.endDate,
        maxUsage: form.maxUsage ? parseInt(form.maxUsage) : null,
        minOrderSum: form.minOrderSum ? parseInt(form.minOrderSum) : null,
      }

      if (editingId) {
        await updatePromoCode(editingId, payload)
      } else {
        await createPromoCode(payload)
      }

      setShowForm(false)
      setForm(emptyForm)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(id: string) {
    setTogglingId(id)
    try {
      await togglePromoCodeActive(id)
      router.refresh()
    } catch {
      // ignore
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(id: string) {
    await deletePromoCode(id)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить промокод
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-sm border border-border space-y-4">
          <h2 className="text-lg font-semibold">
            {editingId ? "Редактировать промокод" : "Новый промокод"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Название *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Весенняя скидка"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Код промокода *</label>
              <input
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary uppercase"
                placeholder="SPRING20"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Комментарий</label>
            <textarea
              value={form.comment}
              onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Заметка для админов"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Тип скидки *</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "percent" | "fixed" }))}
                className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="percent">Процент (%)</option>
                <option value="fixed">Фиксированная (₽)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Значение * {form.type === "percent" ? "(%)" : "(₽)"}
              </label>
              <input
                required
                type="number"
                min="1"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={form.type === "percent" ? "10" : "500"}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Начало действия *</label>
              <input
                required
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Окончание действия *</label>
              <input
                required
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Макс. использований</label>
              <input
                type="number"
                min="1"
                value={form.maxUsage}
                onChange={(e) => setForm((f) => ({ ...f, maxUsage: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Без ограничений"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Мин. сумма заказа (₽)</label>
              <input
                type="number"
                min="0"
                value={form.minOrderSum}
                onChange={(e) => setForm((f) => ({ ...f, minOrderSum: e.target.value }))}
                className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Без ограничений"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingId ? "Сохранить" : "Создать"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {promoCodes.length === 0 ? (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-border text-center text-muted-foreground">
          Промокодов пока нет
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-medium">Название</th>
                <th className="text-left py-3 px-4 font-medium">Код</th>
                <th className="text-left py-3 px-4 font-medium">Тип</th>
                <th className="text-right py-3 px-4 font-medium">Значение</th>
                <th className="text-left py-3 px-4 font-medium">Период</th>
                <th className="text-right py-3 px-4 font-medium">Исп.</th>
                <th className="text-left py-3 px-4 font-medium">Статус</th>
                <th className="text-right py-3 px-4 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {promoCodes.map((promo) => {
                const status = getStatus(promo)
                return (
                  <tr key={promo.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-medium">{promo.name}</span>
                        {promo.comment && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{promo.comment}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">{promo.code}</code>
                    </td>
                    <td className="py-3 px-4">{promo.type === "percent" ? "Процент" : "Фикс."}</td>
                    <td className="py-3 px-4 text-right">
                      {promo.type === "percent" ? `${promo.value}%` : `${promo.value}₽`}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {formatDate(promo.startDate)} — {formatDate(promo.endDate)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {promo.usageCount}{promo.maxUsage !== null ? `/${promo.maxUsage}` : ""}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(promo)}
                          className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                          title="Редактировать"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(promo.id)}
                          disabled={togglingId === promo.id}
                          className="p-1.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                          title={promo.isActive ? "Выключить" : "Включить"}
                        >
                          {togglingId === promo.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : promo.isActive ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>
                        <ConfirmDialog
                          title="Удалить промокод"
                          message={`Удалить промокод "${promo.code}"? Это действие нельзя отменить.`}
                          onConfirm={() => handleDelete(promo.id)}
                        >
                          {(open) => (
                            <button
                              onClick={open}
                              className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </ConfirmDialog>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
