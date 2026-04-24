import Link from "next/link"
import { requireAdmin } from "@/lib/admin-guard"
import { listAccessRequests } from "@/lib/dal/wholesale-requests"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, string> = {
  pending: "Ожидает",
  approved: "Одобрена",
  rejected: "Отклонена",
}

export default async function AdminWholesaleRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string }>
}) {
  await requireAdmin("wholesale.requests.view")
  const params = await searchParams
  const requests = await listAccessRequests({ status: params.status, search: params.search })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Заявки на оптовый доступ</h1>
      </div>

      <form className="flex gap-2 mb-5">
        <input
          type="text"
          name="search"
          placeholder="Поиск по названию / ИНН / email"
          defaultValue={params.search ?? ""}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={params.status ?? "all"}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          <option value="all">Все</option>
          <option value="pending">Ожидают</option>
          <option value="approved">Одобрены</option>
          <option value="rejected">Отклонены</option>
        </select>
        <button className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm">
          Фильтр
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Дата</th>
              <th className="px-4 py-3 text-left">Компания</th>
              <th className="px-4 py-3 text-left">ИНН</th>
              <th className="px-4 py-3 text-left">Контакт</th>
              <th className="px-4 py-3 text-left">Статус</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString("ru")}
                </td>
                <td className="px-4 py-3 font-medium">{r.legalName}</td>
                <td className="px-4 py-3">{r.inn}</td>
                <td className="px-4 py-3">
                  <div>{r.contactName}</div>
                  <div className="text-xs text-muted-foreground">{r.contactEmail}</div>
                  <div className="text-xs text-muted-foreground">{r.contactPhone}</div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                      r.status === "pending"
                        ? "bg-amber-50 text-amber-800 border border-amber-200"
                        : r.status === "approved"
                          ? "bg-green-50 text-green-800 border border-green-200"
                          : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                  >
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/wholesale/requests/${r.id}`}
                    className="text-primary hover:underline text-sm"
                  >
                    Открыть →
                  </Link>
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  Заявок нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
