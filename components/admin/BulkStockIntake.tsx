"use client"

import { useMemo, useState } from "react"
import { X } from "lucide-react"
import type { StockSnapshotRow } from "@/lib/dal/stock"
import { bulkIntakeAction } from "@/lib/actions/stock"

interface Props {
  rows: StockSnapshotRow[]
  onClose: () => void
}

export function BulkStockIntake({ rows, onClose }: Props) {
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState("")
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(
      (r) =>
        r.productName.toLowerCase().includes(q) ||
        r.variantWeight.toLowerCase().includes(q) ||
        r.variantSku?.toLowerCase().includes(q)
    )
  }, [rows, search])

  const nonZeroCount = Object.values(inputs).filter((v) => parseInt(v) > 0).length
  const totalIncoming = Object.values(inputs).reduce((s, v) => s + (parseInt(v) || 0), 0)

  async function handleSave() {
    setSaving(true)
    setError("")
    try {
      const items = Object.entries(inputs)
        .map(([variantId, v]) => ({
          variantId,
          delta: parseInt(v) || 0,
          notes: notes.trim() || undefined,
        }))
        .filter((i) => i.delta > 0)
      if (items.length === 0) {
        setError("Укажите приход хотя бы для одного варианта")
        return
      }
      await bulkIntakeAction(items)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold">Массовый приход</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Введите количество для тех вариантов, которые привезли. Записи с 0 или пусто — игнорируются.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-border flex gap-3 flex-wrap">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск"
            className="flex-1 min-w-[200px] h-9 px-3 rounded-lg border border-input text-sm"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Общий коммент (напр. накладная № 456)"
            className="flex-1 min-w-[200px] h-9 px-3 rounded-lg border border-input text-sm"
          />
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-6 py-2 font-medium">Товар</th>
                <th className="text-left px-4 py-2 font-medium">Вариант</th>
                <th className="text-right px-4 py-2 font-medium">На складе</th>
                <th className="text-right px-4 py-2 font-medium w-32">Приход</th>
                <th className="text-right px-4 py-2 font-medium">Станет</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const delta = parseInt(inputs[r.variantId] || "0") || 0
                return (
                  <tr key={r.variantId} className="border-t border-border hover:bg-muted/10">
                    <td className="px-6 py-2">{r.productName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.variantWeight}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.stock}</td>
                    <td className="px-4 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        value={inputs[r.variantId] || ""}
                        onChange={(e) =>
                          setInputs((prev) => ({ ...prev, [r.variantId]: e.target.value }))
                        }
                        placeholder="0"
                        className="w-20 h-8 px-2 text-right rounded border border-input text-sm tabular-nums"
                      />
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                      {delta > 0 ? r.stock + delta : "—"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {error && (
          <div className="px-6 py-2 text-sm text-red-600 bg-red-50 border-t border-red-100">{error}</div>
        )}

        <div className="px-6 py-3 border-t border-border flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Вариантов: <b className="text-foreground">{nonZeroCount}</b> · Всего единиц:{" "}
            <b className="text-foreground">{totalIncoming}</b>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving || nonZeroCount === 0}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Сохранение..." : `Принять (${nonZeroCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
