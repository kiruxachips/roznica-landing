"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { CheckCircle, Clock, Package, XCircle } from "lucide-react"

interface OrderSummary {
  orderNumber: string
  customerName: string
  customerEmail: string | null
  customerPhone: string
  subtotal: number
  discount: number
  deliveryPrice: number
  total: number
  promoCode: string | null
  items: {
    name: string
    weight: string
    price: number
    quantity: number
  }[]
}

export function ThankYouContent({ order, shouldTrack, paymentStatus }: { order: OrderSummary; shouldTrack: boolean; paymentStatus?: string | null }) {
  const goalSent = useRef(false)

  useEffect(() => {
    if (!shouldTrack || goalSent.current) return
    goalSent.current = true

    if (typeof window !== "undefined" && typeof window.ym === "function") {
      window.ym(106584393, "reachGoal", "purchase", {
        order_price: order.total,
        currency: "RUB",
      })
    }
  }, [shouldTrack, order.total])

  if (paymentStatus === "pending") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-amber-600" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">Оплата не завершена</h1>
          <p className="text-muted-foreground">
            Заказ <span className="font-semibold text-foreground">{order.orderNumber}</span> ожидает оплаты
          </p>
        </div>

        <div className="bg-amber-50 rounded-2xl p-6 sm:p-8 mb-8 text-center">
          <p className="text-sm text-muted-foreground">
            Вы вернулись без завершения оплаты. Заказ сохранён — свяжитесь с нами, если хотите оплатить позже.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/catalog"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-center hover:bg-primary/90 transition-colors"
          >
            Перейти в каталог
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

  if (paymentStatus === "canceled") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">Оплата не прошла</h1>
          <p className="text-muted-foreground">
            Заказ <span className="font-semibold text-foreground">{order.orderNumber}</span> не был оплачен
          </p>
        </div>

        <div className="bg-red-50 rounded-2xl p-6 sm:p-8 mb-8 text-center">
          <p className="text-sm text-muted-foreground mb-1">
            Платёж был отменён. Вы можете оформить новый заказ.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/catalog"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium text-center hover:bg-primary/90 transition-colors"
          >
            Перейти в каталог
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

  return (
    <div className="max-w-2xl mx-auto">
      {/* Success header */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="font-serif text-3xl font-bold mb-2">Спасибо за покупку!</h1>
        <p className="text-muted-foreground">
          Заказ <span className="font-semibold text-foreground">{order.orderNumber}</span> успешно оформлен
        </p>
      </div>

      {/* Order details */}
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
                <p className="text-muted-foreground text-xs">{item.weight} x {item.quantity}</p>
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

      {/* Contact info */}
      <div className="bg-white rounded-2xl p-4 sm:p-8 shadow-sm mb-6 sm:mb-8">
        <h2 className="text-lg font-semibold mb-4">Данные получателя</h2>
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

      {/* What's next */}
      <div className="bg-primary/5 rounded-2xl p-4 sm:p-8 mb-6 sm:mb-8">
        <h2 className="font-semibold mb-3">Что дальше?</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>Мы свяжемся с вами в течение 1-2 часов для подтверждения заказа</li>
          <li>После подтверждения обжарим и отправим ваш кофе на следующий рабочий день</li>
          <li>Вы получите трек-номер для отслеживания посылки</li>
        </ul>
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
