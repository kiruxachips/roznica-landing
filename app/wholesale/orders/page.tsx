import { redirect } from "next/navigation"
import Link from "next/link"
import { getWholesaleContext } from "@/lib/wholesale-guard"
import { WholesaleSidebar } from "@/components/wholesale/Sidebar"
import { getWholesaleOrdersForCompany } from "@/lib/dal/wholesale-orders"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, string> = {
  pending: "Оформлен",
  paid: "Оплачен",
  confirmed: "Подтверждён",
  shipped: "В пути",
  delivered: "Доставлен",
  cancelled: "Отменён",
  payment_failed: "Ошибка оплаты",
}

export default async function WholesaleOrdersPage() {
  const ctx = await getWholesaleContext()
  if (!ctx) redirect("/wholesale/login")

  const orders = await getWholesaleOrdersForCompany(ctx.companyId, { take: 200 })

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        <WholesaleSidebar />
        <div className="flex-1 min-w-0">
          <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-5">Мои заказы</h1>

          {orders.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <p className="text-muted-foreground mb-4">Заказов пока нет</p>
              <Link
                href="/wholesale/catalog"
                className="inline-flex rounded-xl bg-primary text-primary-foreground font-medium px-6 py-2.5"
              >
                В каталог
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm divide-y">
              {orders.map((o) => (
                <Link
                  key={o.id}
                  href={`/wholesale/orders/${o.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{o.orderNumber}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(o.createdAt).toLocaleString("ru")} ·{" "}
                      {STATUS_LABEL[o.status] ?? o.status}
                      {o.approvalStatus === "pending_approval" && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px]">
                          ждёт одобрения
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {o.items.length} позиций
                    </div>
                  </div>
                  <div className="font-semibold text-right shrink-0">
                    {o.total.toLocaleString("ru")}₽
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
