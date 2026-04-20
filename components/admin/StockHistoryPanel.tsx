"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

interface StockHistoryRow {
  id: string
  delta: number
  stockBefore: number
  stockAfter: number
  reason: string
  orderId: string | null
  notes: string | null
  changedBy: string | null
  createdAt: string
}

interface Props {
  variantId: string
  onClose: () => void
}

const REASON_LABELS: Record<string, string> = {
  order_placed: "Заказ оформлен",
  order_cancelled: "Заказ отменён",
  order_restored: "Заказ восстановлен",
  supplier_received: "Приход поставки",
  inventory_correction: "Коррекция",
  write_off: "Списание",
}

export function StockHistoryPanel({ variantId, onClose }: Props) {
  const [rows, setRows] = useState<StockHistoryRow[] | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/admin/stock/${variantId}/history`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setRows(data))
      .catch(() => setError("Не удалось загрузить историю"))
  }, [variantId])

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold">История изменений остатка</h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-auto">
          {error && <div className="p-6 text-sm text-red-600">{error}</div>}
          {!rows && !error && <div className="p-6 text-sm text-muted-foreground">Загрузка...</div>}
          {rows && rows.length === 0 && (
            <div className="p-6 text-sm text-muted-foreground">История пуста</div>
          )}
          {rows && rows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Дата</th>
                  <th className="text-left px-4 py-2 font-medium">Причина</th>
                  <th className="text-right px-4 py-2 font-medium">Изменение</th>
                  <th className="text-right px-4 py-2 font-medium">Стало</th>
                  <th className="text-left px-4 py-2 font-medium">Кто</th>
                  <th className="text-left px-4 py-2 font-medium">Коммент</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-4 py-2">{REASON_LABELS[r.reason] || r.reason}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-semibold ${r.delta > 0 ? "text-green-700" : "text-red-700"}`}>
                      {r.delta > 0 ? "+" : ""}
                      {r.delta}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{r.stockAfter}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{r.changedBy || "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
