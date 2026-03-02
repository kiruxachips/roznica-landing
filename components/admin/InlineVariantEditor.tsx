"use client"

import { useState } from "react"

export interface LocalVariant {
  key: string
  weight: string
  price: number
  oldPrice: number | null
  stock: number
}

interface InlineVariantEditorProps {
  variants: LocalVariant[]
  onChange: (variants: LocalVariant[]) => void
  weightOptions: string[]
}

export function InlineVariantEditor({ variants, onChange, weightOptions }: InlineVariantEditorProps) {
  const [newWeight, setNewWeight] = useState("")
  const [newPrice, setNewPrice] = useState("")
  const [newOldPrice, setNewOldPrice] = useState("")
  const [newStock, setNewStock] = useState("100")

  function handleAdd() {
    if (!newWeight || !newPrice) return

    const variant: LocalVariant = {
      key: `${Date.now()}-${Math.random()}`,
      weight: newWeight,
      price: Number(newPrice),
      oldPrice: newOldPrice ? Number(newOldPrice) : null,
      stock: Number(newStock) || 0,
    }

    onChange([...variants, variant])
    setNewWeight("")
    setNewPrice("")
    setNewOldPrice("")
    setNewStock("100")
  }

  function handleRemove(key: string) {
    onChange(variants.filter((v) => v.key !== key))
  }

  function handleUpdate(key: string, field: keyof LocalVariant, value: string) {
    onChange(
      variants.map((v) => {
        if (v.key !== key) return v
        if (field === "price" || field === "stock") return { ...v, [field]: Number(value) || 0 }
        if (field === "oldPrice") return { ...v, oldPrice: value ? Number(value) : null }
        return { ...v, [field]: value }
      })
    )
  }

  // Available weight options = all options minus already used ones
  const usedWeights = new Set(variants.map((v) => v.weight))
  const availableWeights = weightOptions.filter((w) => !usedWeights.has(w))

  return (
    <div className="space-y-3">
      {variants.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b">
              <th className="pb-2 font-medium">Вес</th>
              <th className="pb-2 font-medium">Цена</th>
              <th className="pb-2 font-medium">Старая цена</th>
              <th className="pb-2 font-medium">Остаток</th>
              <th className="pb-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.key} className="border-b last:border-0">
                <td className="py-2 pr-2">
                  <span className="text-sm font-medium">{v.weight}</span>
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    value={v.price}
                    onChange={(e) => handleUpdate(v.key, "price", e.target.value)}
                    className="w-24 h-8 px-2 rounded border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    value={v.oldPrice ?? ""}
                    onChange={(e) => handleUpdate(v.key, "oldPrice", e.target.value)}
                    placeholder="—"
                    className="w-24 h-8 px-2 rounded border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="number"
                    value={v.stock}
                    onChange={(e) => handleUpdate(v.key, "stock", e.target.value)}
                    className="w-20 h-8 px-2 rounded border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    onClick={() => handleRemove(v.key)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {availableWeights.length > 0 && (
        <div className="flex items-end gap-2 pt-2 border-t border-dashed">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Вес</label>
            <select
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              className="h-8 px-2 rounded border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Выбрать...</option>
              {availableWeights.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Цена</label>
            <input
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="0"
              className="w-24 h-8 px-2 rounded border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Старая цена</label>
            <input
              type="number"
              value={newOldPrice}
              onChange={(e) => setNewOldPrice(e.target.value)}
              placeholder="—"
              className="w-24 h-8 px-2 rounded border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Остаток</label>
            <input
              type="number"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              className="w-20 h-8 px-2 rounded border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newWeight || !newPrice}
            className="h-8 px-3 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
          >
            Добавить
          </button>
        </div>
      )}

      {variants.length === 0 && availableWeights.length === 0 && (
        <p className="text-sm text-muted-foreground">Все доступные варианты веса добавлены</p>
      )}
    </div>
  )
}
