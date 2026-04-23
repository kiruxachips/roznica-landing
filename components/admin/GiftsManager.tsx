"use client"

import { useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Plus, Pencil, Archive, Upload } from "lucide-react"
import {
  createGift,
  updateGift,
  archiveGift,
  uploadGiftImage,
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
}

interface GiftsManagerProps {
  gifts: Gift[]
}

type DraftGift = Partial<Gift> & { name: string; minCartTotal: number }

export function GiftsManager({ gifts }: GiftsManagerProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState<DraftGift | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)
  const [error, setError] = useState("")

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
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 h-10 px-4 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          Добавить подарок
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
                  {g.stock !== null && g.stock <= 0 && (
                    <span className="text-[11px] px-2 py-0.5 bg-red-50 text-red-700 rounded-full">
                      Закончился
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  От {g.minCartTotal}₽ · {g.stock === null ? "без учёта запаса" : `остаток: ${g.stock}`}
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
    </div>
  )
}
