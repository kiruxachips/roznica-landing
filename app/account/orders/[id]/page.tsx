import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { redirect, notFound } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { auth } from "@/lib/auth"
import { getOrderById } from "@/lib/dal/orders"
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge"
import { ReorderButton } from "@/components/account/ReorderButton"
import { CancelOrderButton } from "@/components/account/CancelOrderButton"
import { RefreshTrackingButton } from "@/components/account/RefreshTrackingButton"
import { RetryPaymentButton } from "@/components/account/RetryPaymentButton"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Детали заказа | Millor Coffee",
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const { id } = await params
  const order = await getOrderById(id)

  if (!order || order.userId !== session.user.id) {
    notFound()
  }

  const date = new Date(order.createdAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div>
      <Link
        href="/account/orders"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Мои заказы
      </Link>

      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6 mb-5 sm:mb-6">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-sans font-bold break-words">{order.orderNumber}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">{date}</p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        {/* Order items */}
        <div className="space-y-3 mb-6">
          {order.items.map((item) => (
            <div key={item.id} className="flex gap-4 py-3 border-b border-border last:border-0">
              <div className="w-16 h-16 bg-muted rounded-xl flex items-center justify-center overflow-hidden shrink-0">
                {item.product ? (
                  <Image
                    src={`/uploads/products/${item.productId}/thumb.webp`}
                    alt={item.name}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Фото</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.weight}</p>
                <p className="text-xs text-muted-foreground">{item.quantity} x {item.price}₽</p>
              </div>
              <p className="font-medium text-sm">{item.quantity * item.price}₽</p>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="border-t border-border pt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Подытог</span>
            <span>{order.subtotal}₽</span>
          </div>
          {order.bonusUsed > 0 && (
            <div className="flex justify-between text-amber-600">
              <span>Списано бонусов</span>
              <span>-{order.bonusUsed}₽</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Доставка</span>
            <span>{order.deliveryPrice === 0 ? "Бесплатно" : `${order.deliveryPrice}₽`}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-2 border-t border-border">
            <span>Итого</span>
            <span className="text-primary">{order.total}₽</span>
          </div>
          {order.bonusEarned > 0 && (
            <p className="text-xs text-green-600 pt-1">
              +{order.bonusEarned} бонусов начислено
            </p>
          )}
        </div>

        {/* Payment retry + Reorder + Cancel */}
        <div className="border-t border-border pt-4 mt-4 flex items-center gap-3 flex-wrap">
          {order.paymentMethod === "online" && order.status === "pending" && order.paymentStatus !== "succeeded" && (
            <RetryPaymentButton orderId={order.id} />
          )}
          <ReorderButton
            items={order.items.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
              name: i.name,
              weight: i.weight,
              price: i.price,
              quantity: i.quantity,
            }))}
          />
          {["pending", "paid", "confirmed"].includes(order.status) && !order.carrierOrderId && (
            <CancelOrderButton orderId={order.id} />
          )}
        </div>
      </div>

      {/* Delivery info */}
      <div className="bg-white rounded-2xl shadow-sm p-4 sm:p-6">
        <h2 className="font-semibold mb-3">Информация о доставке</h2>
        <div className="space-y-2 text-sm">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
            <span className="text-muted-foreground">Получатель</span>
            <span>{order.customerName}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
            <span className="text-muted-foreground">Телефон</span>
            <span>{order.customerPhone}</span>
          </div>
          {order.customerEmail && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
              <span className="text-muted-foreground">Email</span>
              <span className="break-all">{order.customerEmail}</span>
            </div>
          )}
          {order.deliveryMethod && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
              <span className="text-muted-foreground">Способ доставки</span>
              <span>{order.deliveryMethod === "cdek" ? "СДЭК" : order.deliveryMethod === "pochta" ? "Почта России" : order.deliveryMethod === "courier" ? "Курьер" : order.deliveryMethod}</span>
            </div>
          )}
          {order.trackingNumber && (
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5">
              <span className="text-muted-foreground">Трек-номер</span>
              <span className="font-mono text-sm break-all">{order.trackingNumber}</span>
            </div>
          )}
          {order.carrierStatus && (
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5">
              <span className="text-muted-foreground">Статус доставки</span>
              <div className="flex items-center gap-2">
                <span>{order.carrierStatus}</span>
                {order.trackingNumber && ["cdek", "pochta"].includes(order.deliveryMethod || "") && (
                  <RefreshTrackingButton orderId={order.id} />
                )}
              </div>
            </div>
          )}
          {order.trackingNumber && (order.deliveryMethod === "pochta" || order.deliveryMethod === "cdek") && (
            <a
              href={
                order.deliveryMethod === "pochta"
                  ? `https://www.pochta.ru/tracking#${order.trackingNumber}`
                  : `https://www.cdek.ru/ru/tracking?order_id=${order.trackingNumber}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Отследить посылку
            </a>
          )}
          {order.deliveryAddress && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
              <span className="text-muted-foreground">Адрес</span>
              <span className="sm:text-right sm:max-w-[60%] break-words">{order.deliveryAddress}</span>
            </div>
          )}
          {order.notes && (
            <div className="flex flex-col sm:flex-row sm:justify-between gap-0.5">
              <span className="text-muted-foreground">Комментарий</span>
              <span className="sm:text-right sm:max-w-[60%]">{order.notes}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
