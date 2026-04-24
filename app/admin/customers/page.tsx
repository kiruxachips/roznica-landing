import Link from "next/link"
import { requireAdmin } from "@/lib/admin-guard"
import { getCustomers } from "@/lib/dal/customers"

export const dynamic = "force-dynamic"

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    page?: string
  }>
}) {
  await requireAdmin("customers.view")
  const sp = await searchParams
  const page = Math.max(1, parseInt(sp.page || "1", 10))
  const status = (sp.status as "all" | "active" | "new" | "repeat" | "deleted") || "all"

  const { customers, total } = await getCustomers({
    search: sp.q,
    status,
    page,
    limit: 30,
  })

  const totalPages = Math.max(1, Math.ceil(total / 30))

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Клиенты</h1>
        <p className="text-sm text-muted-foreground">
          Всего: {total.toLocaleString("ru")} · страница {page} из {totalPages}
        </p>
      </div>

      {/* Фильтры */}
      <form className="flex flex-wrap gap-2 items-center" action="/admin/customers" method="get">
        <input
          type="text"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Имя, email, телефон…"
          className="flex-1 min-w-[200px] h-10 px-3 rounded-lg border border-border text-sm"
        />
        <select
          name="status"
          defaultValue={status}
          className="h-10 px-3 rounded-lg border border-border text-sm bg-white"
        >
          <option value="all">Все активные</option>
          <option value="new">Новые (без заказов)</option>
          <option value="repeat">Повторные (≥2 заказа)</option>
          <option value="deleted">Удалённые</option>
        </select>
        <button
          type="submit"
          className="h-10 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
        >
          Искать
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Клиент</th>
              <th className="px-4 py-3">Контакты</th>
              <th className="px-4 py-3 text-right">Заказов</th>
              <th className="px-4 py-3 text-right">LTV</th>
              <th className="px-4 py-3 text-right">Бонусы</th>
              <th className="px-4 py-3">Зарегистрирован</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  По заданным фильтрам клиенты не найдены
                </td>
              </tr>
            ) : (
              customers.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.name || "Без имени"}
                    </Link>
                    {c.deletedAt && (
                      <span className="ml-2 text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded uppercase font-semibold">
                        удалён
                      </span>
                    )}
                    {!c.firstOrderCompletedAt && !c.deletedAt && (
                      <span className="ml-2 text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded uppercase font-semibold">
                        новый
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{c.email || "—"}</div>
                    {c.phone && <div className="text-xs">{c.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">{c.ordersCount}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    {c.totalSpent.toLocaleString("ru")}₽
                  </td>
                  <td className="px-4 py-3 text-right">
                    {c.bonusBalance > 0 ? (
                      <span className="text-emerald-700">+{c.bonusBalance}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(c.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 text-sm">
          {Array.from({ length: totalPages })
            .slice(0, 10)
            .map((_, i) => {
              const p = i + 1
              const qs = new URLSearchParams()
              if (sp.q) qs.set("q", sp.q)
              if (status !== "all") qs.set("status", status)
              qs.set("page", String(p))
              return (
                <Link
                  key={p}
                  href={`/admin/customers?${qs}`}
                  className={`px-3 py-1.5 rounded-lg ${
                    p === page
                      ? "bg-primary text-primary-foreground"
                      : "bg-white border border-border hover:bg-muted"
                  }`}
                >
                  {p}
                </Link>
              )
            })}
        </div>
      )}
    </div>
  )
}
