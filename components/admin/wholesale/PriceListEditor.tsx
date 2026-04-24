"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  updatePriceList,
  deletePriceList,
  upsertPriceListItem,
  deletePriceListItem,
} from "@/lib/actions/wholesale-price-lists"

interface Variant {
  id: string
  weight: string
  price: number
  sku: string | null
  wholesaleMinQuantity: number | null
  product: { id: string; name: string; slug: string }
}

interface PriceListWithItems {
  id: string
  name: string
  description: string | null
  isActive: boolean
  kind: string
  discountPct: number | null
  minOrderSum: number | null
  items: {
    id: string
    variantId: string
    price: number
    minQuantity: number
  }[]
  companies: { id: string; legalName: string }[]
}

export function PriceListEditor({
  priceList,
  allVariants,
}: {
  priceList: PriceListWithItems
  allVariants: Variant[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [savingRow, setSavingRow] = useState<string | null>(null)

  const itemsByVariant = new Map(priceList.items.map((i) => [i.variantId, i]))

  const filtered = allVariants.filter((v) =>
    search
      ? v.product.name.toLowerCase().includes(search.toLowerCase()) ||
        (v.sku?.toLowerCase().includes(search.toLowerCase()) ?? false)
      : true
  )

  async function handleSavePrice(variantId: string, priceStr: string) {
    const price = Number(priceStr)
    if (isNaN(price) || price < 0) return
    setSavingRow(variantId)
    try {
      await upsertPriceListItem({
        priceListId: priceList.id,
        variantId,
        price,
      })
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка")
    } finally {
      setSavingRow(null)
    }
  }

  async function handleRemovePrice(itemId: string) {
    if (!confirm("Удалить цену для этого SKU?")) return
    try {
      await deletePriceListItem(itemId)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка")
    }
  }

  async function handleSettingsSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    try {
      await updatePriceList(priceList.id, {
        name: String(form.get("name") || priceList.name),
        description: (form.get("description") as string) || null,
        isActive: form.get("isActive") === "on",
        minOrderSum: Number(form.get("minOrderSum") || 0) || null,
        discountPct: Number(form.get("discountPct") || 0) || null,
      })
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка")
    }
  }

  async function handleDelete() {
    if (!confirm("Удалить прайс-лист? Операция необратима.")) return
    try {
      await deletePriceList(priceList.id)
      router.push("/admin/wholesale/price-lists")
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка")
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSettingsSave} className="bg-white rounded-xl shadow-sm p-5 space-y-3">
        <h2 className="font-semibold">Настройки</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Название</label>
            <input
              name="name"
              defaultValue={priceList.name}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Мин. заказ, ₽</label>
            <input
              name="minOrderSum"
              type="number"
              min={0}
              defaultValue={priceList.minOrderSum ?? ""}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
          {priceList.kind === "discount_pct" && (
            <div>
              <label className="block text-sm font-medium mb-1">% скидки</label>
              <input
                name="discountPct"
                type="number"
                min={1}
                max={99}
                defaultValue={priceList.discountPct ?? ""}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm"
              />
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              defaultChecked={priceList.isActive}
              className="rounded"
            />
            <label htmlFor="isActive" className="text-sm">
              Активен
            </label>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Описание</label>
            <textarea
              name="description"
              defaultValue={priceList.description ?? ""}
              rows={2}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium"
          >
            Сохранить
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg border border-red-300 text-red-700 px-4 py-2 text-sm hover:bg-red-50"
          >
            Удалить прайс-лист
          </button>
        </div>
      </form>

      {priceList.companies.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold mb-2">Используется компаниями</h2>
          <div className="flex flex-wrap gap-2">
            {priceList.companies.map((c) => (
              <span
                key={c.id}
                className="inline-flex rounded-full bg-secondary px-3 py-1 text-xs"
              >
                {c.legalName}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Цены по SKU ({priceList.items.length} задано)</h2>
          <input
            type="text"
            placeholder="Поиск по товару / SKU"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-lg border border-border px-3 py-1.5 text-sm w-64"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2">Товар</th>
                <th className="text-left py-2">SKU</th>
                <th className="text-right py-2">Розница</th>
                <th className="text-right py-2">Опт</th>
                <th className="text-right py-2">Эффект</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((v) => {
                const item = itemsByVariant.get(v.id)
                const delta = item ? v.price - item.price : null
                return (
                  <tr key={v.id}>
                    <td className="py-2">
                      <div className="font-medium">{v.product.name}</div>
                      <div className="text-xs text-muted-foreground">{v.weight}</div>
                    </td>
                    <td className="py-2 text-xs">{v.sku ?? "—"}</td>
                    <td className="py-2 text-right text-xs">{v.price.toLocaleString("ru")}₽</td>
                    <td className="py-2 text-right">
                      <PriceInput
                        initialPrice={item?.price ?? null}
                        retail={v.price}
                        priceListKind={priceList.kind}
                        discountPct={priceList.discountPct}
                        disabled={savingRow === v.id}
                        onSave={(price) => handleSavePrice(v.id, price)}
                      />
                    </td>
                    <td className="py-2 text-right text-xs">
                      {delta !== null && item
                        ? `−${delta.toLocaleString("ru")}₽ (${Math.round((delta / v.price) * 100)}%)`
                        : priceList.kind === "discount_pct" && priceList.discountPct
                          ? `−${priceList.discountPct}%`
                          : "—"}
                    </td>
                    <td className="py-2 text-right">
                      {item && (
                        <button
                          onClick={() => handleRemovePrice(item.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          удалить
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PriceInput({
  initialPrice,
  retail,
  priceListKind,
  discountPct,
  disabled,
  onSave,
}: {
  initialPrice: number | null
  retail: number
  priceListKind: string
  discountPct: number | null
  disabled: boolean
  onSave: (price: string) => void
}) {
  const placeholder =
    priceListKind === "discount_pct" && discountPct
      ? String(Math.round(retail * (1 - discountPct / 100)))
      : String(retail)

  return (
    <input
      type="number"
      min={0}
      defaultValue={initialPrice ?? ""}
      placeholder={placeholder}
      disabled={disabled}
      onBlur={(e) => {
        if (e.target.value && Number(e.target.value) !== initialPrice) {
          onSave(e.target.value)
        }
      }}
      className="w-24 rounded border border-border px-2 py-1 text-sm text-right"
    />
  )
}
