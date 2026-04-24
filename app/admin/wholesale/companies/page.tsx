import Link from "next/link"
import { requireAdmin } from "@/lib/admin-guard"
import { listWholesaleCompanies } from "@/lib/dal/wholesale-companies"

export const dynamic = "force-dynamic"

export default async function AdminWholesaleCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>
}) {
  await requireAdmin("wholesale.companies.view")
  const params = await searchParams
  const companies = await listWholesaleCompanies({
    status: params.status,
    search: params.search,
  })

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Оптовые компании</h1>

      <form className="flex gap-2 mb-5">
        <input
          type="text"
          name="search"
          placeholder="Поиск по названию / ИНН"
          defaultValue={params.search ?? ""}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={params.status ?? "all"}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          <option value="all">Все</option>
          <option value="active">Активные</option>
          <option value="suspended">Приостановленные</option>
          <option value="rejected">Отклонённые</option>
        </select>
        <button className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm">
          Фильтр
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Компания</th>
              <th className="px-4 py-3 text-left">ИНН</th>
              <th className="px-4 py-3 text-left">Статус</th>
              <th className="px-4 py-3 text-left">Прайс</th>
              <th className="px-4 py-3 text-left">Условия</th>
              <th className="px-4 py-3 text-right">Лимит отсрочки</th>
              <th className="px-4 py-3 text-right">Заказы</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {companies.map((c) => {
              const available = c.creditLimit - c.creditUsed
              return (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.legalName}</div>
                    {c.managerName && (
                      <div className="text-xs text-muted-foreground">
                        менеджер: {c.managerName}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">{c.inn}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                        c.status === "active"
                          ? "bg-green-50 text-green-800 border border-green-200"
                          : c.status === "suspended"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                      }`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">{c.priceListName ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{c.paymentTerms}</td>
                  <td className="px-4 py-3 text-right text-xs">
                    {c.paymentTerms === "prepay" ? (
                      "—"
                    ) : (
                      <>
                        <div>{available.toLocaleString("ru")}₽</div>
                        <div className="text-muted-foreground">из {c.creditLimit.toLocaleString("ru")}₽</div>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{c.ordersCount}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/wholesale/companies/${c.id}`} className="text-primary hover:underline">
                      Открыть →
                    </Link>
                  </td>
                </tr>
              )
            })}
            {companies.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Компаний нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
