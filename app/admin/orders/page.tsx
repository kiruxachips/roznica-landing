export const dynamic = "force-dynamic"

import Link from "next/link"
import { getOrders } from "@/lib/dal/orders"

const statusLabels: Record<string, string> = {
  pending: "Новый",
  confirmed: "Подтверждён",
  shipped: "Отправлен",
  delivered: "Доставлен",
  cancelled: "Отменён",
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  confirmed: "bg-blue-50 text-blue-700",
  shipped: "bg-purple-50 text-purple-700",
  delivered: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const params = await searchParams
  const status = params.status
  const page = Number(params.page) || 1

  const { orders, total } = await getOrders({ status, page })
  const totalPages = Math.ceil(total / 20)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Заказы</h1>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <Link href="/admin/orders" className={`px-3 py-1.5 rounded-lg text-sm ${!status ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
          Все
        </Link>
        {Object.entries(statusLabels).map(([key, label]) => (
          <Link key={key} href={`/admin/orders?status=${key}`} className={`px-3 py-1.5 rounded-lg text-sm ${status === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
            {label}
          </Link>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Номер</th>
              <th className="text-left px-4 py-3 font-medium">Клиент</th>
              <th className="text-left px-4 py-3 font-medium">Сумма</th>
              <th className="text-left px-4 py-3 font-medium">Статус</th>
              <th className="text-left px-4 py-3 font-medium">Дата</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${order.id}`} className="font-medium text-primary hover:underline">
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p>{order.customerName}</p>
                    <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">{order.total}₽</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusStyles[order.status] ?? "bg-gray-50 text-gray-700"}`}>
                    {statusLabels[order.status] ?? order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">Нет заказов</div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex gap-2 justify-center mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/orders?${status ? `status=${status}&` : ""}page=${p}`}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm ${p === page ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
