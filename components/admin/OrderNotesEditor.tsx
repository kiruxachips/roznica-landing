"use client"

import { useState } from "react"
import { updateOrderNotes } from "@/lib/actions/orders"

export function OrderNotesEditor({ orderId, initialNotes }: { orderId: string; initialNotes: string | null }) {
  const [notes, setNotes] = useState(initialNotes || "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await updateOrderNotes(orderId, notes)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
      <h2 className="text-lg font-semibold mb-3">Заметки</h2>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Внутренние заметки к заказу..."
        className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y"
      />
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? "..." : "Сохранить"}
        </button>
        {saved && <span className="text-sm text-green-600">Сохранено</span>}
      </div>
    </div>
  )
}
