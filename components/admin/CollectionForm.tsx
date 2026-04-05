"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { updateCollection, addProductToCollection, removeProductFromCollection } from "@/lib/actions/collections"

interface CollectionProduct {
  id: string
  product: { id: string; name: string; slug: string }
  sortOrder: number
}

interface Props {
  collection: {
    id: string
    name: string
    slug: string
    description: string | null
    emoji: string | null
    isActive: boolean
    products: CollectionProduct[]
  }
  allProducts: { id: string; name: string; slug: string }[]
}

export function CollectionForm({ collection, allProducts }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [name, setName] = useState(collection.name)
  const [slug, setSlug] = useState(collection.slug)
  const [description, setDescription] = useState(collection.description || "")
  const [emoji, setEmoji] = useState(collection.emoji || "")
  const [isActive, setIsActive] = useState(collection.isActive)
  const [addingProduct, setAddingProduct] = useState("")

  const existingProductIds = new Set(collection.products.map((p) => p.product.id))
  const availableProducts = allProducts.filter((p) => !existingProductIds.has(p.id))

  async function handleSave() {
    setSaving(true)
    setMessage("")
    try {
      await updateCollection(collection.id, { name, slug, description: description || undefined, emoji: emoji || undefined, isActive })
      setMessage("Сохранено")
      router.refresh()
    } catch {
      setMessage("Ошибка сохранения")
    } finally {
      setSaving(false)
    }
  }

  async function handleAddProduct() {
    if (!addingProduct) return
    setSaving(true)
    try {
      await addProductToCollection(collection.id, addingProduct)
      setAddingProduct("")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveProduct(productId: string) {
    setSaving(true)
    try {
      await removeProductFromCollection(collection.id, productId)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"

  return (
    <div className="space-y-6">
      {/* Settings */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-border space-y-4">
        <h2 className="text-lg font-semibold">Настройки</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Название</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Slug</label>
            <input className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Emoji</label>
            <input className={inputClass} value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="☕" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded accent-primary" />
              <span className="text-sm font-medium">Активна</span>
            </label>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Описание</label>
          <input className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Необязательно" />
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            {saving ? "..." : "Сохранить"}
          </button>
          {message && <span className={`text-sm ${message === "Сохранено" ? "text-green-600" : "text-red-600"}`}>{message}</span>}
        </div>
      </div>

      {/* Products */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-border space-y-4">
        <h2 className="text-lg font-semibold">Товары ({collection.products.length})</h2>

        {collection.products.length > 0 && (
          <div className="space-y-2">
            {collection.products.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                <span className="text-sm font-medium">{item.product.name}</span>
                <button onClick={() => handleRemoveProduct(item.product.id)} disabled={saving} className="p-1 text-muted-foreground hover:text-red-500 transition-colors disabled:opacity-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <select
            value={addingProduct}
            onChange={(e) => setAddingProduct(e.target.value)}
            className={`${inputClass} flex-1`}
          >
            <option value="">Добавить товар...</option>
            {availableProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button onClick={handleAddProduct} disabled={saving || !addingProduct} className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
            Добавить
          </button>
        </div>
      </div>
    </div>
  )
}
