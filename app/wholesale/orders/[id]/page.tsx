import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { getWholesaleContext } from "@/lib/wholesale-guard"
import { WholesaleSidebar } from "@/components/wholesale/Sidebar"
import { getWholesaleOrderByIdForCompany } from "@/lib/dal/wholesale-orders"
import { getInvoiceByOrderId } from "@/lib/dal/wholesale-invoices"

export const dynamic = "force-dynamic"

export default async function WholesaleOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await getWholesaleContext()
  if (!ctx) redirect("/wholesale/login")

  const order = await getWholesaleOrderByIdForCompany(id, ctx.companyId)
  if (!order) notFound()
  const invoice = await getInvoiceByOrderId(id)

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col lg:flex-row gap-5 lg:gap-8">
        <WholesaleSidebar />
        <div className="flex-1 min-w-0 space-y-5">
          <div>
            <Link href="/wholesale/orders" className="text-sm text-muted-foreground hover:text-foreground">
              ← Все заказы
            </Link>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold mt-1">
              Заказ {order.orderNumber}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {new Date(order.createdAt).toLocaleString("ru")}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <section className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold mb-3">Позиции</h2>
              <div className="divide-y">
                {order.items.map((item) => (
                  <div key={item.id} className="py-3 flex justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.weight} × {item.quantity} шт
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-semibold">
                        {(item.price * item.quantity).toLocaleString("ru")}₽
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.price.toLocaleString("ru")}₽/шт
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <h2 className="font-semibold">Итого</h2>
              <div className="space-y-1.5 text-sm">
                <Row label="Сумма позиций" value={`${order.subtotal.toLocaleString("ru")}₽`} />
                {order.deliveryPrice > 0 && (
                  <Row label="Доставка" value={`${order.deliveryPrice.toLocaleString("ru")}₽`} />
                )}
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>К оплате</span>
                  <span>{order.total.toLocaleString("ru")}₽</span>
                </div>
              </div>
              <div className="pt-3 border-t space-y-1.5 text-sm">
                <Row label="Статус" value={order.status} />
                {order.approvalStatus && (
                  <Row label="Одобрение" value={order.approvalStatus} />
                )}
                <Row
                  label="Условия"
                  value={
                    order.paymentTerms === "prepay"
                      ? "Предоплата"
                      : `Отсрочка ${order.paymentTerms?.replace("net", "")} дн.`
                  }
                />
                {order.trackingNumber && (
                  <Row label="Трек" value={order.trackingNumber} />
                )}
              </div>
            </section>
          </div>

          <section className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold mb-3">Доставка</h2>
            <p className="text-sm whitespace-pre-wrap">
              {order.deliveryAddress || "—"}
            </p>
          </section>

          {invoice?.pdfUrl && (
            <section className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold mb-2">Документы</h2>
              <a
                href={invoice.pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-primary/10 text-primary font-medium px-4 py-2 hover:bg-primary/15"
              >
                📄 Счёт {invoice.number} (PDF)
              </a>
            </section>
          )}

          {order.statusLogs.length > 0 && (
            <section className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold mb-3">История статусов</h2>
              <div className="divide-y">
                {order.statusLogs.map((log) => (
                  <div key={log.id} className="py-2 text-sm flex justify-between">
                    <span>
                      {log.fromStatus} → <strong>{log.toStatus}</strong>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(log.createdAt).toLocaleString("ru")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  )
}
