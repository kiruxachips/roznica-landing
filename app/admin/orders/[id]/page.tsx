import { notFound } from "next/navigation"
import Link from "next/link"
import { getOrderById } from "@/lib/dal/orders"
import { prisma } from "@/lib/prisma"
import { OrderStatusChanger } from "./OrderStatusChanger"
import { OrderDeliverySection } from "./OrderDeliverySection"
import { OrderNotesEditor } from "@/components/admin/OrderNotesEditor"

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await getOrderById(id)

  if (!order) notFound()

  const statusLogs = order.statusLogs

  const emailDispatches = await prisma.emailDispatch.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      kind: true,
      recipient: true,
      status: true,
      attempts: true,
      messageId: true,
      error: true,
      sentAt: true,
      createdAt: true,
    },
  })

  const kindLabels: Record<string, string> = {
    "order.confirmation": "Оформлен (клиенту)",
    "order.payment_success": "Оплачен (клиенту)",
    "order.payment_failed": "Отмена оплаты (клиенту)",
    "order.shipped": "Отправлен (клиенту)",
    "order.delivered": "Доставлен (клиенту)",
    "admin.new_order": "Новый заказ (админу)",
    "admin.payment_success": "Оплата получена (админу)",
  }
  const statusStyles: Record<string, string> = {
    sent: "bg-green-50 text-green-700",
    pending: "bg-amber-50 text-amber-700",
    failed: "bg-red-50 text-red-700",
    dead: "bg-gray-900 text-white",
  }
  const statusLabels: Record<string, string> = {
    sent: "Отправлено",
    pending: "Ожидает",
    failed: "Ошибка",
    dead: "Не дошло",
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Заказ {order.orderNumber}</h1>

      <div className="space-y-6">
        {/* Status */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">Статус</h2>
          <OrderStatusChanger orderId={order.id} currentStatus={order.status} />
        </div>

        {/* Payment info */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">Оплата</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Способ оплаты:</span>
              <p className="font-medium mt-0.5">{order.paymentMethod === "online" ? "Онлайн (YooKassa)" : "При получении"}</p>
            </div>
            {order.paymentId && (
              <>
                <div>
                  <span className="text-muted-foreground">Статус платежа:</span>
                  <p className="font-medium mt-0.5">{order.paymentStatus || "—"}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">ID платежа:</span>
                  <p className="font-medium font-mono text-xs mt-0.5">{order.paymentId}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Delivery info */}
        {order.deliveryMethod && (
          <OrderDeliverySection
            orderId={order.id}
            deliveryMethod={order.deliveryMethod}
            deliveryType={order.deliveryType}
            destinationCity={order.destinationCity}
            estimatedDelivery={order.estimatedDelivery}
            trackingNumber={order.trackingNumber}
            carrierOrderId={order.carrierOrderId}
            carrierOrderNum={order.carrierOrderNum}
            carrierStatus={order.carrierStatus}
            pickupPointName={order.pickupPointName}
            packagePlan={order.packagePlan}
            packageWeight={order.packageWeight}
            tariffCode={order.tariffCode}
          />
        )}

        {/* Customer info */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">Клиент</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Имя:</span>
              <p className="font-medium">{order.customerName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Телефон:</span>
              <p className="font-medium">{order.customerPhone}</p>
            </div>
            {order.customerEmail && (
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{order.customerEmail}</p>
              </div>
            )}
            {order.deliveryAddress && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Адрес:</span>
                <p className="font-medium">{order.deliveryAddress}</p>
              </div>
            )}
            {order.notes && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Комментарий:</span>
                <p className="font-medium">{order.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">Товары</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 font-medium">Товар</th>
                <th className="text-left py-2 font-medium">Вес</th>
                <th className="text-right py-2 font-medium">Цена</th>
                <th className="text-right py-2 font-medium">Кол-во</th>
                <th className="text-right py-2 font-medium">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2">{item.weight}</td>
                  <td className="py-2 text-right">{item.price}₽</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right font-medium">{item.price * item.quantity}₽</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-border mt-4 pt-4 space-y-1 text-sm text-right">
            <p>Подытог: {order.subtotal}₽</p>
            {order.discount > 0 && (
              <p className="text-green-600">
                Скидка{order.promoCode ? ` (${order.promoCode.code})` : ""}: -{order.discount}₽
              </p>
            )}
            {order.bonusUsed > 0 && (
              <p className="text-amber-600">Списано бонусов: -{order.bonusUsed}₽</p>
            )}
            <p>Доставка: {order.deliveryPrice === 0 ? "Бесплатно" : `${order.deliveryPrice}₽`}</p>
            <p className="text-lg font-bold">Итого: {order.total}₽</p>
            {order.bonusEarned > 0 && (
              <p className="text-green-600 text-xs">+{order.bonusEarned} бонусов начислено</p>
            )}
          </div>
        </div>

        {/* Admin notes */}
        <OrderNotesEditor orderId={order.id} initialNotes={order.adminNotes} />

        {/* Status history */}
        {statusLogs.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
            <h2 className="text-lg font-semibold mb-3">История статусов</h2>
            <div className="space-y-2">
              {statusLogs.map((log) => (
                <div key={log.id} className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("ru-RU", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  <span>{log.fromStatus} → {log.toStatus}</span>
                  {log.changedBy && (
                    <span className="text-xs text-muted-foreground">({log.changedBy})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Email dispatch */}
        {emailDispatches.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Письма по заказу</h2>
              <Link
                href="/admin/email-dispatch"
                className="text-xs text-primary hover:underline"
              >
                Все рассылки →
              </Link>
            </div>
            <div className="space-y-2">
              {emailDispatches.map((d) => (
                <div key={d.id} className="flex items-start gap-3 text-sm border-b border-border last:border-0 pb-2 last:pb-0">
                  <span className="text-muted-foreground text-xs whitespace-nowrap w-28">
                    {new Date(d.createdAt).toLocaleString("ru-RU", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{kindLabels[d.kind] || d.kind}</p>
                    <p className="text-xs text-muted-foreground truncate">→ {d.recipient}</p>
                    {d.error && (
                      <p className="text-xs text-red-700 mt-0.5 font-mono break-words">{d.error}</p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusStyles[d.status] || "bg-gray-100"}`}>
                    {statusLabels[d.status] || d.status}
                    {d.attempts > 1 && ` · ${d.attempts}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Создан: {new Date(order.createdAt).toLocaleString("ru-RU")}
        </p>
      </div>
    </div>
  )
}
