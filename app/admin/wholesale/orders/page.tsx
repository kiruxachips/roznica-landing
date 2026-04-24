import Link from "next/link"
import { requireAdmin } from "@/lib/admin-guard"
import { listAdminWholesaleOrders } from "@/lib/dal/wholesale-orders"

export const dynamic = "force-dynamic"

export default async function AdminWholesaleOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    approvalStatus?: string
    companyId?: string
    search?: string
  }>
}) {
  await requireAdmin("wholesale.orders.view")
  const params = await searchParams
  const orders = await listAdminWholesaleOrders(params)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Оптовые заказы</h1>

      <form className="flex flex-wrap gap-2 mb-5">
        <input
          type="text"
          name="search"
          placeholder="Номер / Компания / ИНН"
          defaultValue={params.search ?? ""}
          className="flex-1 min-w-48 rounded-lg border border-border px-3 py-2 text-sm"
        />
        <select
          name="status"
          defaultValue={params.status ?? "all"}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          <option value="all">Все статусы</option>
          <option value="pending">Оформлен</option>
          <option value="confirmed">Подтверждён</option>
          <option value="paid">Оплачен</option>
          <option value="shipped">В пути</option>
          <option value="delivered">Доставлен</option>
          <option value="cancelled">Отменён</option>
        </select>
        <select
          name="approvalStatus"
          defaultValue={params.approvalStatus ?? "all"}
          className="rounded-lg border border-border px-3 py-2 text-sm"
        >
          <option value="all">Все апрувы</option>
          <option value="pending_approval">Ждут одобрения</option>
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
              <th className="px-4 py-3 text-left">Номер</th>
              <th className="px-4 py-3 text-left">Компания</th>
              <th className="px-4 py-3 text-left">Статус</th>
              <th className="px-4 py-3 text-left">Апрув</th>
              <th className="px-4 py-3 text-left">Условия</th>
              <th className="px-4 py-3 text-right">Сумма</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(o.createdAt).toLocaleString("ru")}
                </td>
                <td className="px-4 py-3 font-medium">{o.orderNumber}</td>
                <td className="px-4 py-3">
                  <div>{o.wholesaleCompany?.legalName ?? o.b2bLegalName ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">ИНН {o.b2bInn ?? "—"}</div>
                </td>
                <td className="px-4 py-3 text-xs">{o.status}</td>
                <td className="px-4 py-3 text-xs">
                  {o.approvalStatus === "pending_approval" ? (
                    <span className="rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5">
                      ждёт одобрения
                    </span>
                  ) : (
                    o.approvalStatus ?? "—"
                  )}
                </td>
                <td className="px-4 py-3 text-xs">{o.paymentTerms}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {o.total.toLocaleString("ru")}₽
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/orders/${o.id}`} className="text-primary hover:underline">
                    →
                  </Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  Оптовых заказов нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
