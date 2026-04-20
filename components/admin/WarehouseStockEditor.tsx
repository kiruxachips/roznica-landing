"use client"

import { useState } from "react"
import { X } from "lucide-react"
import type { StockSnapshotRow } from "@/lib/dal/stock"
import { adjustStockAction } from "@/lib/actions/stock"
import type { StockReason } from "@/lib/dal/stock"

interface Props {
  row: StockSnapshotRow
  onClose: () => void
}

const REASONS: { value: StockReason; label: string; signHint: "+" | "-" | "both" }[] = [
  { value: "supplier_received", label: "Приход от поставщика", signHint: "+" },
  { value: "inventory_correction", label: "Ручная коррекция", signHint: "both" },
  { value: "write_off", label: "Списание (брак / потеря)", signHint: "-" },
]

export function WarehouseStockEditor({ row, onClose }: Props) {
  const [reason, setReason] = useState<StockReason>("supplier_received")
  const [deltaStr, setDeltaStr] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const delta = parseInt(deltaStr) || 0
  const sign = REASONS.find((r) => r.value === reason)?.signHint ?? "both"
  const signedDelta = sign === "-" ? -Math.abs(delta) : sign === "+" ? Math.abs(delta) : delta
  const nextStock = row.stock + signedDelta

  async function handleSave() {
    if (signedDelta === 0) {
      setError("Укажите ненулевое количество")
      return
    }
    if (nextStock < 0) {
      setError(`На складе только ${row.stock} шт., нельзя списать ${Math.abs(signedDelta)}`)
      return
    }
    setSaving(true)
    setError("")
    try {
      await adjustStockAction({
        variantId: row.variantId,
        delta: signedDelta,
        reason,
        notes: notes.trim() || undefined,
      })
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
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{row.productName}</h3>
            <p className="text-sm text-muted-foreground">
              Вариант: {row.variantWeight} · текущий остаток: <span className="font-semibold">{row.stock}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Причина</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as StockReason)}
              className="w-full h-10 px-3 rounded-lg border border-input text-sm"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Количество {sign === "+" ? "(приход)" : sign === "-" ? "(списание)" : "(+ или −)"}
            </label>
            <input
              type="number"
              value={deltaStr}
              onChange={(e) => setDeltaStr(e.target.value)}
              placeholder={sign === "both" ? "+5 или -2" : "напр. 10"}
              className="w-full h-10 px-3 rounded-lg border border-input text-sm tabular-nums"
            />
            {delta !== 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Новый остаток: <span className={`font-semibold ${nextStock < 0 ? "text-red-600" : ""}`}>{nextStock}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Комментарий (необязательно)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Напр. накладная № 123"
              className="w-full h-10 px-3 rounded-lg border border-input text-sm"
            />
          </div>
        </div>

        {error && <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={saving || signedDelta === 0}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  )
}
