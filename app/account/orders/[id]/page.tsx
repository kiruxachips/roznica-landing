import { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { redirect, notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getOrderById } from "@/lib/dal/orders"
import { OrderStatusBadge } from "@/components/account/OrderStatusBadge"
import { ReorderButton } from "@/components/account/ReorderButton"

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

      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-serif font-bold">{order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">{date}</p>
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

        {/* Reorder */}
        <div className="border-t border-border pt-4 mt-4">
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
        </div>
      </div>

      {/* Delivery info */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="font-semibold mb-3">Информация о доставке</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Получатель</span>
            <span>{order.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Телефон</span>
            <span>{order.customerPhone}</span>
          </div>
          {order.customerEmail && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{order.customerEmail}</span>
            </div>
          )}
          {order.deliveryMethod && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Способ доставки</span>
              <span>{order.deliveryMethod === "cdek" ? "СДЭК" : order.deliveryMethod === "post" ? "Почта России" : order.deliveryMethod === "courier" ? "Курьер" : order.deliveryMethod}</span>
            </div>
          )}
          {order.deliveryAddress && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Адрес</span>
              <span className="text-right max-w-[60%]">{order.deliveryAddress}</span>
            </div>
          )}
          {order.notes && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Комментарий</span>
              <span className="text-right max-w-[60%]">{order.notes}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
