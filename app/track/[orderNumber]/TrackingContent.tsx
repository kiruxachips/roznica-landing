"use client"

import Link from "next/link"
import { CheckCircle, Clock, Package, Truck, XCircle, MapPin, User } from "lucide-react"

interface OrderDetails {
  orderNumber: string
  status: string
  paymentStatus: string | null
  customerName: string
  customerEmail: string | null
  customerPhone: string
  subtotal: number
  discount: number
  deliveryPrice: number
  total: number
  promoCode: string | null
  deliveryMethod: string | null
  deliveryType: string | null
  deliveryAddress: string | null
  pickupPointName: string | null
  destinationCity: string | null
  estimatedDelivery: string | null
  trackingNumber: string | null
  items: {
    name: string
    weight: string
    price: number
    quantity: number
  }[]
  statusLogs: {
    toStatus: string
    createdAt: string
  }[]
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Ожидает подтверждения",
  paid: "Оплачен",
  confirmed: "Подтверждён",
  shipped: "Передан в доставку",
  delivered: "Доставлен",
  payment_failed: "Ошибка оплаты",
  cancelled: "Отменён",
}

const CARRIER_LABELS: Record<string, string> = {
  cdek: "СДЭК",
  pochta: "Почта России",
  courier: "Курьер",
}

function trackingUrl(carrier: string | null, num: string | null): string | null {
  if (!num) return null
  const t = encodeURIComponent(num)
  if (carrier === "cdek") return `https://www.cdek.ru/ru/tracking?order_id=${t}`
  if (carrier === "pochta") return `https://www.pochta.ru/tracking?barcode=${t}`
  return null
}

function statusIcon(status: string) {
  if (status === "delivered") return <CheckCircle className="w-10 h-10 text-green-600" />
  if (status === "shipped") return <Truck className="w-10 h-10 text-primary" />
  if (status === "cancelled" || status === "payment_failed") return <XCircle className="w-10 h-10 text-red-600" />
  if (status === "confirmed" || status === "paid") return <Package className="w-10 h-10 text-primary" />
  return <Clock className="w-10 h-10 text-amber-600" />
}

function statusBgColor(status: string) {
  if (status === "delivered") return "bg-green-50"
  if (status === "cancelled" || status === "payment_failed") return "bg-red-50"
  if (status === "shipped" || status === "confirmed" || status === "paid") return "bg-primary/5"
  return "bg-amber-50"
}

export function TrackingContent({ order }: { order: OrderDetails }) {
  const statusLabel = STATUS_LABELS[order.status] || order.status
  const carrierLabel = order.deliveryMethod ? CARRIER_LABELS[order.deliveryMethod] || order.deliveryMethod : null
  const trackUrl = trackingUrl(order.deliveryMethod, order.trackingNumber)

  return (
    <div className="max-w-2xl mx-auto">
      {/* Status header */}
      <div className="text-center mb-8">
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${statusBgColor(order.status)}`}>
          {statusIcon(order.status)}
        </div>
        <h1 className="font-sans text-2xl sm:text-3xl font-bold mb-2">{statusLabel}</h1>
        <p className="text-muted-foreground">
          Заказ <span className="font-semibold text-foreground">{order.orderNumber}</span>
        </p>
      </div>

      {/* Tracking number — if shipped */}
      {order.trackingNumber && (
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm mb-5 sm:mb-6 text-center">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Трек-номер</p>
          <p className="text-lg sm:text-xl font-bold text-primary tracking-wider mb-3">{order.trackingNumber}</p>
          {trackUrl && (
            <a
              href={trackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Отследить посылку
            </a>
          )}
        </div>
      )}

      {/* Status timeline */}
      {order.statusLogs.length > 0 && (
        <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm mb-5 sm:mb-6">
          <h2 className="text-lg font-semibold mb-4">История статусов</h2>
          <ol className="space-y-3">
            {order.statusLogs.map((log, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{STATUS_LABELS[log.toStatus] || log.toStatus}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Order composition */}
      <div className="bg-white rounded-2xl p-4 sm:p-8 shadow-sm mb-5 sm:mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Package className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Состав заказа</h2>
        </div>

        <div className="space-y-3 mb-5">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between items-start text-sm">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-muted-foreground text-xs">
                  {item.weight} × {item.quantity}
                </p>
              </div>
              <span className="font-medium flex-shrink-0">{item.price * item.quantity}₽</span>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Подытог</span>
            <span>{order.subtotal}₽</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Скидка{order.promoCode ? ` (${order.promoCode})` : ""}</span>
              <span>-{order.discount}₽</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Доставка</span>
            <span>{order.deliveryPrice === 0 ? "Бесплатно" : `${order.deliveryPrice}₽`}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
            <span>Итого</span>
            <span className="text-primary">{order.total}₽</span>
          </div>
        </div>
      </div>

      {/* Delivery info */}
      {(carrierLabel || order.deliveryAddress || order.pickupPointName) && (
        <div className="bg-white rounded-2xl p-4 sm:p-8 shadow-sm mb-5 sm:mb-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Доставка</h2>
          </div>
          <div className="space-y-2 text-sm">
            {carrierLabel && (
              <div>
                <span className="text-muted-foreground">Служба:</span>{" "}
                <span className="font-medium">{carrierLabel}</span>
              </div>
            )}
            {order.destinationCity && (
              <div>
                <span className="text-muted-foreground">Город:</span>{" "}
                <span className="font-medium">{order.destinationCity}</span>
              </div>
            )}
            {order.pickupPointName && (
              <div>
                <span className="text-muted-foreground">Пункт выдачи:</span>{" "}
                <span className="font-medium">{order.pickupPointName}</span>
              </div>
            )}
            {order.deliveryAddress && (
              <div>
                <span className="text-muted-foreground">Адрес:</span>{" "}
                <span className="font-medium">{order.deliveryAddress}</span>
              </div>
            )}
            {order.estimatedDelivery && (
              <div>
                <span className="text-muted-foreground">Срок:</span>{" "}
                <span className="font-medium">{order.estimatedDelivery}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contact info */}
      <div className="bg-white rounded-2xl p-4 sm:p-8 shadow-sm mb-6 sm:mb-8">
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Данные получателя</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Имя</span>
            <p className="font-medium">{order.customerName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Телефон</span>
            <p className="font-medium">{order.customerPhone}</p>
          </div>
          {order.customerEmail && (
            <div>
              <span className="text-muted-foreground">Email</span>
              <p className="font-medium">{order.customerEmail}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/catalog"
          className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-center hover:bg-primary/90 transition-colors"
        >
          Продолжить покупки
        </Link>
        <Link
          href="/"
          className="px-6 py-3 border border-border rounded-xl font-medium text-center hover:bg-muted transition-colors"
        >
          На главную
        </Link>
      </div>
    </div>
  )
}
