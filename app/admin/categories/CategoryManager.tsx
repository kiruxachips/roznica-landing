"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createCategory, updateCategory, deleteCategory } from "@/lib/actions/categories"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { Plus, Pencil, Trash2 } from "lucide-react"

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  sortOrder: number
  isActive: boolean
  productCount: number
}

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [description, setDescription] = useState("")
  const [saving, setSaving] = useState(false)

  function generateSlug(text: string) {
    const map: Record<string, string> = {
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
      з: "z", и: "i", й: "j", к: "k", л: "l", м: "m", н: "n", о: "o",
      п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c",
      ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
    }
    return text.toLowerCase().split("").map((ch) => map[ch] || ch).join("").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  }

  async function handleAdd() {
    if (!name) return
    setSaving(true)
    try {
      await createCategory({ name, slug: slug || generateSlug(name), description: description || undefined })
      setAdding(false)
      setName("")
      setSlug("")
      setDescription("")
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  function startEdit(c: Category) {
    setEditing(c.id)
    setName(c.name)
    setSlug(c.slug)
    setDescription(c.description ?? "")
  }

  async function handleUpdate() {
    if (!editing || !name) return
    setSaving(true)
    try {
      await updateCategory(editing, { name, slug, description: description || undefined })
      setEditing(null)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Название</th>
            <th className="text-left px-4 py-3 font-medium">Slug</th>
            <th className="text-left px-4 py-3 font-medium">Товаров</th>
            <th className="text-left px-4 py-3 font-medium">Статус</th>
            <th className="w-24 px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {categories.map((c) => (
            <tr key={c.id} className="border-t border-border">
              {editing === c.id ? (
                <>
                  <td className="px-4 py-2">
                    <input value={name} onChange={(e) => setName(e.target.value)} className="w-full h-8 px-2 rounded border border-input text-sm" />
                  </td>
                  <td className="px-4 py-2">
                    <input value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full h-8 px-2 rounded border border-input text-sm" />
                  </td>
                  <td className="px-4 py-2">{c.productCount}</td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={handleUpdate} disabled={saving} className="px-2 py-1 bg-primary text-primary-foreground rounded text-xs">
                        OK
                      </button>
                      <button onClick={() => setEditing(null)} className="px-2 py-1 border border-border rounded text-xs">
                        X
                      </button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.slug}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.productCount}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${c.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {c.isActive ? "Активна" : "Скрыта"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(c)} className="p-2 text-muted-foreground hover:text-primary rounded-lg hover:bg-muted">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {c.productCount === 0 && (
                        <ConfirmDialog
                          title="Удалить категорию?"
                          message={`Категория "${c.name}" будет удалена.`}
                          onConfirm={async () => {
                            await deleteCategory(c.id)
                            router.refresh()
                          }}
                        >
                          {(open) => (
                            <button onClick={open} className="p-2 text-muted-foreground hover:text-red-600 rounded-lg hover:bg-muted">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </ConfirmDialog>
                      )}
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="p-4 border-t border-border">
        {adding ? (
          <div className="flex items-center gap-2">
            <input value={name} onChange={(e) => { setName(e.target.value); setSlug(generateSlug(e.target.value)) }} placeholder="Название" className="h-8 px-2 rounded border border-input text-sm" />
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Slug" className="h-8 px-2 rounded border border-input text-sm" />
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Описание" className="h-8 px-2 rounded border border-input text-sm flex-1" />
            <button onClick={handleAdd} disabled={saving} className="h-8 px-3 bg-primary text-primary-foreground rounded text-sm">
              {saving ? "..." : "Добавить"}
            </button>
            <button onClick={() => setAdding(false)} className="h-8 px-3 border border-border rounded text-sm">
              Отмена
            </button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-2 text-sm text-primary hover:underline">
            <Plus className="w-4 h-4" /> Добавить категорию
          </button>
        )}
      </div>
    </div>
  )
}
