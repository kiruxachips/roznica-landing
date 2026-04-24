export const dynamic = "force-dynamic"

import Link from "next/link"
import { getAllCollections } from "@/lib/dal/collections"
import { createCollection, deleteCollection } from "@/lib/actions/collections"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/admin-guard"

export default async function AdminCollectionsPage() {
  await requireAdmin("collections.view")
  const collections = await getAllCollections()

  async function handleCreate(formData: FormData) {
    "use server"
    const name = formData.get("name") as string
    if (!name.trim()) return
    const slug = name.toLowerCase()
      .replace(/[а-яё]/g, (c) => {
        const map: Record<string, string> = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"h",ц:"ts",ч:"ch",ш:"sh",щ:"sch",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya" }
        return map[c] || c
      })
      .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-")
    await createCollection({ name: name.trim(), slug })
    revalidatePath("/admin/collections")
  }

  async function handleDelete(formData: FormData) {
    "use server"
    const id = formData.get("id") as string
    await deleteCollection(id)
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Подборки</h1>

      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Подборка</th>
              <th className="text-left px-4 py-3 font-medium">Slug</th>
              <th className="text-left px-4 py-3 font-medium">Товаров</th>
              <th className="text-left px-4 py-3 font-medium">Статус</th>
              <th className="text-right px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {collections.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <Link href={`/admin/collections/${c.id}`} className="font-medium text-primary hover:underline">
                    {c.emoji && `${c.emoji} `}{c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{c.slug}</td>
                <td className="px-4 py-3">{c._count.products}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${c.isActive ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}`}>
                    {c.isActive ? "Активна" : "Скрыта"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {c._count.products === 0 && (
                    <form action={handleDelete} className="inline">
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="text-xs text-red-600 hover:text-red-700">Удалить</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {collections.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">Нет подборок</div>
        )}
      </div>

      <form action={handleCreate} className="bg-white rounded-xl p-6 shadow-sm border border-border flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Новая подборка</label>
          <input
            name="name"
            required
            placeholder="Идеально с молоком"
            className="w-full h-10 px-3 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button type="submit" className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          Создать
        </button>
      </form>
    </div>
  )
}
