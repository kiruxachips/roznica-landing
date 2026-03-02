import { notFound } from "next/navigation"
import { getOrderById } from "@/lib/dal/orders"
import { OrderStatusChanger } from "./OrderStatusChanger"

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const order = await getOrderById(id)

  if (!order) notFound()

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
        {order.paymentId && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
            <h2 className="text-lg font-semibold mb-4">Оплата</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">ID платежа:</span>
                <p className="font-medium font-mono text-xs mt-0.5">{order.paymentId}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Статус платежа:</span>
                <p className="font-medium mt-0.5">{order.paymentStatus || "—"}</p>
              </div>
            </div>
          </div>
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

        <p className="text-sm text-muted-foreground">
          Создан: {new Date(order.createdAt).toLocaleString("ru-RU")}
        </p>
      </div>
    </div>
  )
}
