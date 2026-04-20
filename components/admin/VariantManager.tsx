"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createVariant, updateVariant, deleteVariant } from "@/lib/actions/products"
import { Trash2, Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface Variant {
  id: string
  weight: string
  price: number
  oldPrice: number | null
  stock: number
  lowStockThreshold: number | null
  sortOrder: number
  isActive: boolean
}

export function VariantManager({ productId, variants }: { productId: string; variants: Variant[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [newWeight, setNewWeight] = useState("250г")
  const [newPrice, setNewPrice] = useState("")
  const [newOldPrice, setNewOldPrice] = useState("")
  const [newStock, setNewStock] = useState("100")
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (!newPrice) return
    setSaving(true)
    try {
      await createVariant({
        productId,
        weight: newWeight,
        price: Number(newPrice),
        oldPrice: newOldPrice ? Number(newOldPrice) : undefined,
        stock: Number(newStock),
        sortOrder: variants.length,
      })
      setAdding(false)
      setNewPrice("")
      setNewOldPrice("")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteVariant(id)
    router.refresh()
  }

  async function handleUpdate(id: string, field: string, value: string) {
    const trimmed = value.trim()
    if (field === "lowStockThreshold" && trimmed === "") {
      await updateVariant(id, { lowStockThreshold: null })
      router.refresh()
      return
    }
    const numValue = Number(trimmed)
    if (isNaN(numValue)) return
    await updateVariant(id, { [field]: numValue })
    router.refresh()
  }

  async function handleToggleActive(id: string, currentActive: boolean) {
    await updateVariant(id, { isActive: !currentActive })
    router.refresh()
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 font-medium">Вес</th>
            <th className="text-left py-2 font-medium">Цена</th>
            <th className="text-left py-2 font-medium">Старая цена</th>
            <th className="text-left py-2 font-medium">Остаток</th>
            <th className="text-left py-2 font-medium" title="Порог уведомления о низком остатке">Порог</th>
            <th className="text-left py-2 font-medium">Активен</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody>
          {variants.map((v) => (
            <tr key={v.id} className={cn("border-b border-border", !v.isActive && "opacity-50")}>
              <td className="py-2">{v.weight}</td>
              <td className="py-2">
                <input
                  type="number"
                  defaultValue={v.price}
                  onBlur={(e) => handleUpdate(v.id, "price", e.target.value)}
                  className="w-24 h-8 px-2 rounded border border-input text-sm"
                />
              </td>
              <td className="py-2">
                <input
                  type="number"
                  defaultValue={v.oldPrice ?? ""}
                  onBlur={(e) => handleUpdate(v.id, "oldPrice", e.target.value)}
                  className="w-24 h-8 px-2 rounded border border-input text-sm"
                />
              </td>
              <td className="py-2">
                <input
                  type="number"
                  defaultValue={v.stock}
                  onBlur={(e) => handleUpdate(v.id, "stock", e.target.value)}
                  className="w-20 h-8 px-2 rounded border border-input text-sm"
                />
              </td>
              <td className="py-2">
                <input
                  type="number"
                  min={0}
                  defaultValue={v.lowStockThreshold ?? ""}
                  placeholder="—"
                  onBlur={(e) => handleUpdate(v.id, "lowStockThreshold", e.target.value)}
                  className="w-16 h-8 px-2 rounded border border-input text-sm"
                />
              </td>
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={v.isActive}
                  onChange={() => handleToggleActive(v.id, v.isActive)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
              </td>
              <td className="py-2">
                <button onClick={() => handleDelete(v.id)} className="p-1 text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adding ? (
        <div className="flex items-center gap-2 mt-3">
          <select value={newWeight} onChange={(e) => setNewWeight(e.target.value)} className="h-8 px-2 rounded border border-input text-sm">
            <option value="250г">250г</option>
            <option value="1кг">1кг</option>
          </select>
          <input type="number" placeholder="Цена" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className="w-24 h-8 px-2 rounded border border-input text-sm" />
          <input type="number" placeholder="Стар. цена" value={newOldPrice} onChange={(e) => setNewOldPrice(e.target.value)} className="w-24 h-8 px-2 rounded border border-input text-sm" />
          <input type="number" placeholder="Остаток" value={newStock} onChange={(e) => setNewStock(e.target.value)} className="w-20 h-8 px-2 rounded border border-input text-sm" />
          <button onClick={handleAdd} disabled={saving} className="h-8 px-3 bg-primary text-primary-foreground rounded text-sm disabled:opacity-50">
            {saving ? "..." : "Добавить"}
          </button>
          <button onClick={() => setAdding(false)} className="h-8 px-3 border border-border rounded text-sm">
            Отмена
          </button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-3 flex items-center gap-2 text-sm text-primary hover:underline">
          <Plus className="w-4 h-4" /> Добавить вариант
        </button>
      )}
    </div>
  )
}
