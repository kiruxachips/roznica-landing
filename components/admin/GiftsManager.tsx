"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Archive, Upload, PowerOff, Power } from "lucide-react"
import {
  createGift,
  updateGift,
  archiveGift,
  uploadGiftImage,
  setGiftsEnabled,
} from "@/lib/actions/gifts"

interface Gift {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  imageAlt: string | null
  minCartTotal: number
  stock: number | null
  isActive: boolean
  sortOrder: number
  productVariantId: string | null
  productVariant: {
    id: string
    weight: string
    sku: string | null
    stock: number
    product: { id: string; name: string; isActive: boolean }
  } | null
}

interface GiftsManagerProps {
  gifts: Gift[]
  /** Текущее состояние kill-switch — передаётся server-render'ом */
  initialEnabled: boolean
}

type DraftGift = Partial<Gift> & { name: string; minCartTotal: number }

interface VariantOption {
  variantId: string
  productId: string
  productName: string
  productSlug: string
  weight: string
  sku: string | null
  price: number
  stock: number
  daysSinceLastSale: number | null
  linkedToActiveGift: boolean
  isActive: boolean
}

export function GiftsManager({ gifts, initialEnabled }: GiftsManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState<DraftGift | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [programEnabled, setProgramEnabled] = useState(initialEnabled)
  const [toggling, setToggling] = useState(false)

  async function handleToggleProgram() {
    const next = !programEnabled
    // Дополнительная защита от случайного выключения
    if (
      !next &&
      !confirm(
        "Выключить подарочную программу?\n\nКлиенты перестанут видеть подарки на checkout и в корзине. Пул подарков в этом списке сохранится и вернётся при включении обратно."
      )
    ) return

    setToggling(true)
    try {
      await setGiftsEnabled(next)
      setProgramEnabled(next)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Не удалось переключить")
    } finally {
      setToggling(false)
    }
  }

  // Product-picker
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState("")
  const [pickerSort, setPickerSort] = useState<"stock" | "stale">("stale")
  const [variants, setVariants] = useState<VariantOption[]>([])
  const [variantsLoading, setVariantsLoading] = useState(false)

  function openPicker() {
    setPickerOpen(true)
    setPickerSearch("")
    fetchVariants("")
  }

  async function fetchVariants(search: string) {
    setVariantsLoading(true)
    try {
      const qs = search ? `?search=${encodeURIComponent(search)}` : ""
      const res = await fetch(`/api/admin/gifts/variants${qs}`)
      if (res.ok) {
        const data = await res.json()
        setVariants(data.variants || [])
      }
    } finally {
      setVariantsLoading(false)
    }
  }

  const sortedVariants = [...variants].sort((a, b) => {
    if (pickerSort === "stock") {
      return b.stock - a.stock
    }
    // "stale" — сначала те, что давно не продавались; без продаж (null) — в начало.
    const aDays = a.daysSinceLastSale ?? Infinity
    const bDays = b.daysSinceLastSale ?? Infinity
    return bDays - aDays
  })

  async function addFromVariant(v: VariantOption) {
    if (!confirm(`Создать подарок "${v.productName} (${v.weight})"? Порог по умолчанию — 3000₽, можно поменять.`)) return
    try {
      await createGift({
        name: `${v.productName} (${v.weight}) в подарок`,
        description: `Вариант из каталога. Остаток на складе: ${v.stock}.`,
        minCartTotal: 3000,
        productVariantId: v.variantId,
      })
      setPickerOpen(false)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка")
    }
  }

  function openCreate() {
    setEditing({
      name: "",
      description: "",
      minCartTotal: 5000,
      stock: null,
      isActive: true,
      sortOrder: 0,
    })
    setError("")
  }

  function openEdit(g: Gift) {
    setEditing(g)
    setError("")
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editing) return
    setError("")

    const form = new FormData(e.currentTarget)
    const name = (form.get("name") as string).trim()
    const description = (form.get("description") as string) || ""
    const minCartTotal = parseInt((form.get("minCartTotal") as string) || "0", 10)
    const stockRaw = (form.get("stock") as string) || ""
    const stock = stockRaw === "" ? null : parseInt(stockRaw, 10)
    const isActive = form.get("isActive") === "on"
    const sortOrder = parseInt((form.get("sortOrder") as string) || "0", 10)

    try {
      if (editing.id) {
        await updateGift(editing.id, {
          name,
          description,
          minCartTotal,
          stock,
          isActive,
          sortOrder,
        })
      } else {
        await createGift({
          name,
          description,
          minCartTotal,
          stock: stock,
          isActive,
          sortOrder,
        })
      }
      setEditing(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить")
    }
  }

  function handleArchive(id: string, name: string) {
    if (!confirm(`Архивировать "${name}"? Подарок станет неактивным; исторические заказы с ним сохранятся.`)) return
    startTransition(async () => {
      try {
        await archiveGift(id)
        router.refresh()
      } catch (e) {
        alert(e instanceof Error ? e.message : "Ошибка")
      }
    })
  }

  async function handleImageUpload(giftId: string, file: File, alt: string) {
    setError("")
    setUploadingFor(giftId)
    try {
      const fd = new FormData()
      fd.set("giftId", giftId)
      fd.set("file", file)
      fd.set("alt", alt)
      await uploadGiftImage(fd)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить изображение")
    } finally {
      setUploadingFor(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Kill-switch программы — переключатель в том же разделе что и сам пул */}
      <div
        className={`rounded-2xl border p-4 flex items-center gap-4 ${
          programEnabled
            ? "bg-emerald-50/60 border-emerald-200"
            : "bg-red-50/60 border-red-200"
        }`}
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            programEnabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          }`}
        >
          {programEnabled ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold">
            Программа подарков {programEnabled ? "включена" : "выключена"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {programEnabled
              ? "Клиенты видят подарки на checkout и в корзине. Выключение мгновенно скрывает весь gift-UI, но пул ниже сохраняется."
              : "Подарки нигде не показываются клиентам. Пул ниже не потерян — включите обратно, и всё вернётся."}
          </p>
        </div>
        <button
          onClick={handleToggleProgram}
          disabled={toggling}
          className={`shrink-0 h-10 px-5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
            programEnabled
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          {toggling
            ? "Сохранение…"
            : programEnabled
              ? "Выключить программу"
              : "Включить программу"}
        </button>
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={openPicker}
          className="inline-flex items-center gap-2 h-10 px-4 border border-primary/30 text-primary rounded-xl text-sm font-medium hover:bg-primary/5"
          title="Выбрать товар из каталога — полезно чтобы раздавать неликвид"
        >
          <Plus className="w-4 h-4" />
          Из каталога
        </button>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 h-10 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Кастомный подарок
        </button>
      </div>

      {gifts.length === 0 && !editing && (
        <div className="bg-white rounded-2xl border border-border p-8 text-center text-sm text-muted-foreground">
          Пока нет подарков. Создайте первый — клиенты увидят его на checkout при
          достижении указанного порога стоимости заказа.
        </div>
      )}

      {gifts.length > 0 && (
        <div className="bg-white rounded-2xl border border-border divide-y divide-border">
          {gifts.map((g) => (
            <div key={g.id} className="p-4 flex items-start gap-4">
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {g.imageUrl ? (
                  <Image
                    src={g.imageUrl}
                    alt={g.imageAlt || g.name}
                    width={64}
                    height={64}
                    className="w-16 h-16 object-cover"
                  />
                ) : (
                  <span className="text-[10px] text-muted-foreground">нет фото</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{g.name}</p>
                  {!g.isActive && (
                    <span className="text-[11px] px-2 py-0.5 bg-muted text-muted-foreground rounded-full">
                      Архив
                    </span>
                  )}
                  {g.productVariantId && (
                    <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                      Из каталога
                    </span>
                  )}
                  {/* Out-of-stock индикатор учитывает linked-случай */}
                  {(() => {
                    const effStock = g.productVariantId
                      ? g.productVariant?.stock ?? 0
                      : g.stock
                    if (effStock !== null && effStock <= 0) {
                      return (
                        <span className="text-[11px] px-2 py-0.5 bg-red-50 text-red-700 rounded-full">
                          Закончился
                        </span>
                      )
                    }
                    return null
                  })()}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  От {g.minCartTotal}₽ · {(() => {
                    if (g.productVariantId) {
                      return g.productVariant
                        ? `линк: ${g.productVariant.product.name} (${g.productVariant.weight}), остаток ${g.productVariant.stock}`
                        : "линк потерян — вариант удалён"
                    }
                    return g.stock === null ? "без учёта запаса" : `остаток: ${g.stock}`
                  })()}
                </p>
                {g.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.description}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <label className="text-xs text-primary cursor-pointer hover:underline flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingFor === g.id ? "Загрузка…" : "Фото"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleImageUpload(g.id, f, g.imageAlt || g.name)
                    }}
                  />
                </label>
                <button
                  onClick={() => openEdit(g)}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Изменить
                </button>
                {g.isActive && (
                  <button
                    onClick={() => handleArchive(g.id, g.name)}
                    disabled={isPending}
                    className="text-xs text-muted-foreground hover:text-red-600 flex items-center gap-1 disabled:opacity-50"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    Архивировать
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-lg font-semibold mb-4">
              {editing.id ? "Редактирование подарка" : "Новый подарок"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Название *</label>
                <input
                  name="name"
                  required
                  defaultValue={editing.name || ""}
                  className="w-full h-11 px-4 rounded-xl border border-input text-sm"
                  placeholder="Кружка Millor"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Описание</label>
                <textarea
                  name="description"
                  rows={2}
                  defaultValue={editing.description || ""}
                  className="w-full px-4 py-3 rounded-xl border border-input text-sm"
                  placeholder="Краткое описание для клиента"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Порог, ₽ *</label>
                  <input
                    name="minCartTotal"
                    type="number"
                    min={0}
                    step={100}
                    required
                    defaultValue={editing.minCartTotal}
                    className="w-full h-11 px-4 rounded-xl border border-input text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    От какой суммы заказа доступен
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Запас</label>
                  <input
                    name="stock"
                    type="number"
                    min={0}
                    defaultValue={editing.stock ?? ""}
                    className="w-full h-11 px-4 rounded-xl border border-input text-sm"
                    placeholder="∞"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Пусто = без учёта
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Порядок отображения</label>
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={editing.sortOrder ?? 0}
                  className="w-full h-11 px-4 rounded-xl border border-input text-sm"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked={editing.isActive ?? true}
                  className="h-4 w-4 accent-primary"
                />
                <span className="text-sm">Активен</span>
              </label>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="flex-1 h-11 border border-border rounded-xl text-sm font-medium hover:bg-muted"
                >
                  Отменить
                </button>
              </div>
            </div>

            {editing.id && (
              <p className="text-xs text-muted-foreground mt-4 text-center">
                Изображение загружается отдельной кнопкой на карточке списка.
              </p>
            )}
          </form>
        </div>
      )}

      {/* GP2: product-picker с stock-insights для дарения неликвида */}
      {pickerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl p-5 max-w-3xl w-full shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Выбрать вариант из каталога</h2>
              <button
                onClick={() => setPickerOpen(false)}
                className="text-muted-foreground hover:text-foreground p-2"
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Подсветка помогает дарить неликвид: варианты с большим запасом и давним
              отсутствием продаж — сверху. При выдаче подарка остаток на складе уменьшится автоматически.
            </p>

            <div className="flex gap-2 mb-3">
              <input
                type="search"
                placeholder="Поиск по названию или SKU…"
                value={pickerSearch}
                onChange={(e) => {
                  setPickerSearch(e.target.value)
                  fetchVariants(e.target.value)
                }}
                className="flex-1 h-10 px-3 rounded-lg border border-input text-sm"
              />
              <select
                value={pickerSort}
                onChange={(e) => setPickerSort(e.target.value as "stock" | "stale")}
                className="h-10 px-3 rounded-lg border border-input text-sm bg-white"
              >
                <option value="stale">Давность продаж</option>
                <option value="stock">Размер остатка</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto border border-border rounded-xl divide-y divide-border">
              {variantsLoading && (
                <p className="p-6 text-center text-sm text-muted-foreground">Загрузка…</p>
              )}
              {!variantsLoading && sortedVariants.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Нет активных вариантов
                </p>
              )}
              {sortedVariants.map((v) => {
                const staleTag =
                  v.daysSinceLastSale === null
                    ? "Никогда не продавался"
                    : v.daysSinceLastSale >= 90
                      ? `Давно не продаётся (${v.daysSinceLastSale} дн.)`
                      : v.daysSinceLastSale >= 30
                        ? `${v.daysSinceLastSale} дн. без продаж`
                        : `${v.daysSinceLastSale} дн. назад`
                const isStale =
                  v.daysSinceLastSale === null || (v.daysSinceLastSale ?? 0) >= 60
                return (
                  <div
                    key={v.variantId}
                    className={`p-3 flex items-center gap-3 ${isStale ? "bg-amber-50/40" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {v.productName}
                        <span className="text-xs text-muted-foreground ml-2">
                          {v.weight}
                          {v.sku ? ` · ${v.sku}` : ""}
                        </span>
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            v.stock === 0
                              ? "bg-red-50 text-red-700"
                              : v.stock < 5
                                ? "bg-amber-50 text-amber-800"
                                : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          Остаток: {v.stock}
                        </span>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full ${
                            isStale ? "bg-amber-100 text-amber-800" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {staleTag}
                        </span>
                        {v.linkedToActiveGift && (
                          <span className="text-[11px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                            Уже в подарках
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => addFromVariant(v)}
                      disabled={v.stock === 0 || v.linkedToActiveGift}
                      className="shrink-0 h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {v.linkedToActiveGift ? "Уже выбран" : "Добавить"}
                    </button>
                  </div>
                )
              })}
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              💡 Жёлтая подсветка — варианты, которые давно не продавались (≥60 дней) или никогда. Отличные кандидаты для подарков.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
