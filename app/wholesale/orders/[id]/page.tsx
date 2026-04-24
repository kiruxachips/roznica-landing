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
              ← Все заявки
            </Link>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold mt-1">
              Заявка {order.orderNumber}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {new Date(order.createdAt).toLocaleString("ru")}
            </p>
          </div>

          {(() => {
            const stage =
              order.status === "cancelled"
                ? { kind: "rejected" as const }
                : order.approvalStatus === "pending_approval"
                  ? { kind: "pending_approval" as const }
                  : order.paymentStatus !== "succeeded"
                    ? { kind: "awaiting_payment" as const }
                    : order.status === "shipped" || order.status === "delivered"
                      ? { kind: "in_delivery" as const }
                      : { kind: "paid" as const }

            const map = {
              pending_approval: {
                color: "bg-amber-50 border-amber-200 text-amber-900",
                title: "Заявка на рассмотрении",
                text: "Менеджер изучает вашу заявку. Товар зарезервирован на складе. Обычно ответ приходит в течение рабочего дня — мы свяжемся с вами.",
              },
              awaiting_payment: {
                color: "bg-blue-50 border-blue-200 text-blue-900",
                title: invoice ? `Счёт ${invoice.number} выставлен — ждём оплату` : "Счёт готовится",
                text: invoice?.pdfUrl
                  ? "Скачайте PDF-счёт ниже, оплатите 100% по платёжному поручению. После поступления оплаты мы сформируем доставку."
                  : "Менеджер формирует счёт. Он придёт отдельным письмом в ближайшее время.",
              },
              paid: {
                color: "bg-green-50 border-green-200 text-green-900",
                title: "Оплата получена — формируем доставку",
                text: "Спасибо! Готовим отгрузку, скоро пришлём трек-номер.",
              },
              in_delivery: {
                color: "bg-primary/10 border-primary/30 text-primary",
                title: "Заказ в доставке",
                text: order.trackingNumber
                  ? `Трек-номер: ${order.trackingNumber}`
                  : "Ожидайте трек-номер.",
              },
              rejected: {
                color: "bg-red-50 border-red-200 text-red-800",
                title: "Заявка отклонена",
                text: "Товар возвращён на склад. Если нужна помощь — напишите менеджеру.",
              },
            } as const
            const s = map[stage.kind]
            return (
              <div className={`rounded-2xl border p-4 ${s.color}`}>
                <div className="font-semibold">{s.title}</div>
                <div className="text-sm mt-1 opacity-90">{s.text}</div>
              </div>
            )
          })()}

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
