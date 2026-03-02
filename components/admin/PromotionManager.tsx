"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { updatePromotion } from "@/lib/actions/products"
import { Save, Loader2 } from "lucide-react"

interface PromotionVariant {
  id: string
  weight: string
  price: number
  oldPrice: number | null
  isActive: boolean
}

interface PromotionProduct {
  id: string
  name: string
  slug: string
  isFeatured: boolean
  badge: string | null
  sortOrder: number
  image: string | null
  variants: PromotionVariant[]
}

interface RowState {
  isFeatured: boolean
  badge: string
  sortOrder: string
  variants: Record<string, { price: string; oldPrice: string }>
}

export function PromotionManager({ products }: { products: PromotionProduct[] }) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<string | null>(null)

  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const initial: Record<string, RowState> = {}
    for (const p of products) {
      const variants: Record<string, { price: string; oldPrice: string }> = {}
      for (const v of p.variants) {
        variants[v.id] = {
          price: String(v.price),
          oldPrice: v.oldPrice != null ? String(v.oldPrice) : "",
        }
      }
      initial[p.id] = {
        isFeatured: p.isFeatured,
        badge: p.badge ?? "",
        sortOrder: String(p.sortOrder),
        variants,
      }
    }
    return initial
  })

  function updateRow(productId: string, field: keyof Omit<RowState, "variants">, value: string | boolean) {
    setRows((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }))
  }

  function updateVariantField(productId: string, variantId: string, field: "price" | "oldPrice", value: string) {
    setRows((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        variants: {
          ...prev[productId].variants,
          [variantId]: { ...prev[productId].variants[variantId], [field]: value },
        },
      },
    }))
  }

  async function handleSave(productId: string) {
    const row = rows[productId]
    setSavingId(productId)
    try {
      const variantUpdates = Object.entries(row.variants).map(([id, v]) => ({
        id,
        price: Number(v.price) || 0,
        oldPrice: v.oldPrice ? Number(v.oldPrice) : null,
      }))

      await updatePromotion(productId, {
        isFeatured: row.isFeatured,
        badge: row.badge || null,
        sortOrder: Number(row.sortOrder) || 0,
        variants: variantUpdates,
      })
      router.refresh()
    } finally {
      setSavingId(null)
    }
  }

  function getVariantByWeight(product: PromotionProduct, weight: string) {
    return product.variants.find((v) => v.weight === weight)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Товар</th>
              <th className="text-center px-3 py-3 font-medium whitespace-nowrap">На главной</th>
              <th className="text-left px-3 py-3 font-medium">Бейдж</th>
              <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Цена 250г</th>
              <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Стар. 250г</th>
              <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Цена 1кг</th>
              <th className="text-left px-3 py-3 font-medium whitespace-nowrap">Стар. 1кг</th>
              <th className="text-left px-3 py-3 font-medium">Порядок</th>
              <th className="w-16 px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const row = rows[product.id]
              const v250 = getVariantByWeight(product, "250г")
              const v1kg = getVariantByWeight(product, "1кг")
              const isSaving = savingId === product.id

              return (
                <tr key={product.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          width={40}
                          height={40}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-muted" />
                      )}
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={row.isFeatured}
                      onChange={(e) => updateRow(product.id, "isFeatured", e.target.checked)}
                      className="w-4 h-4 accent-primary cursor-pointer"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="text"
                      value={row.badge}
                      onChange={(e) => updateRow(product.id, "badge", e.target.value)}
                      placeholder="Хит продаж"
                      className="w-28 h-8 px-2 rounded border border-input text-sm"
                    />
                  </td>
                  <td className="px-3 py-3">
                    {v250 ? (
                      <input
                        type="number"
                        value={row.variants[v250.id]?.price ?? ""}
                        onChange={(e) => updateVariantField(product.id, v250.id, "price", e.target.value)}
                        className="w-20 h-8 px-2 rounded border border-input text-sm"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {v250 ? (
                      <input
                        type="number"
                        value={row.variants[v250.id]?.oldPrice ?? ""}
                        onChange={(e) => updateVariantField(product.id, v250.id, "oldPrice", e.target.value)}
                        className="w-20 h-8 px-2 rounded border border-input text-sm"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {v1kg ? (
                      <input
                        type="number"
                        value={row.variants[v1kg.id]?.price ?? ""}
                        onChange={(e) => updateVariantField(product.id, v1kg.id, "price", e.target.value)}
                        className="w-20 h-8 px-2 rounded border border-input text-sm"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {v1kg ? (
                      <input
                        type="number"
                        value={row.variants[v1kg.id]?.oldPrice ?? ""}
                        onChange={(e) => updateVariantField(product.id, v1kg.id, "oldPrice", e.target.value)}
                        className="w-20 h-8 px-2 rounded border border-input text-sm"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number"
                      value={row.sortOrder}
                      onChange={(e) => updateRow(product.id, "sortOrder", e.target.value)}
                      className="w-16 h-8 px-2 rounded border border-input text-sm"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => handleSave(product.id)}
                      disabled={isSaving}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                      title="Сохранить"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {products.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          Нет товаров в категории &quot;Зерновой кофе&quot;
        </div>
      )}
    </div>
  )
}
