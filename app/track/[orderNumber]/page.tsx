import { Metadata } from "next"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { TrackingContent } from "./TrackingContent"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Отслеживание заказа | Millor Coffee",
  robots: { index: false, follow: false },
}

/**
 * Permanent-страница для отслеживания заказа. В отличие от /thank-you
 * не обнуляет токен и может открываться многократно (из email-ссылок).
 *
 * Доступ:
 *  - авторизованный владелец (order.userId === session.user.id) — без токена
 *  - по ?token=<trackingToken> — для гостевых заказов или любых повторных визитов
 *  - иначе — 404
 */
export default async function TrackOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>
  searchParams: Promise<{ token?: string }>
}) {
  const { orderNumber } = await params
  const { token } = await searchParams

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      promoCode: { select: { code: true } },
      statusLogs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  })

  if (!order) notFound()

  // Access control: либо токен совпадает, либо юзер — владелец заказа
  const session = await auth()
  const isOwner = session?.user?.id && order.userId === session.user.id
  const tokenMatches = token && order.trackingToken && token === order.trackingToken

  if (!isOwner && !tokenMatches) notFound()

  return (
    <>
      <Header />
      <main className="pt-20 sm:pt-24 pb-12 sm:pb-16 min-h-screen bg-secondary/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <TrackingContent
            order={{
              orderNumber: order.orderNumber,
              status: order.status,
              paymentStatus: order.paymentStatus,
              customerName: order.customerName,
              customerEmail: order.customerEmail,
              customerPhone: order.customerPhone,
              subtotal: order.subtotal,
              discount: order.discount,
              deliveryPrice: order.deliveryPrice,
              total: order.total,
              promoCode: order.promoCode?.code ?? null,
              deliveryMethod: order.deliveryMethod,
              deliveryType: order.deliveryType,
              deliveryAddress: order.deliveryAddress,
              pickupPointName: order.pickupPointName,
              destinationCity: order.destinationCity,
              estimatedDelivery: order.estimatedDelivery,
              trackingNumber: order.trackingNumber,
              giftName: order.giftNameSnapshot,
              items: order.items.map((item) => ({
                name: item.name,
                weight: item.weight,
                price: item.price,
                quantity: item.quantity,
              })),
              statusLogs: order.statusLogs.map((l) => ({
                toStatus: l.toStatus,
                createdAt: l.createdAt.toISOString(),
              })),
            }}
          />
        </div>
      </main>
      <Footer />
    </>
  )
}
