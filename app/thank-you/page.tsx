import { Metadata } from "next"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { ThankYouContent } from "./ThankYouContent"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Спасибо за покупку | Millor Coffee",
  robots: { index: false, follow: false },
}

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>
}) {
  const params = await searchParams
  const orderNumber = params.order
  const token = params.token

  if (!orderNumber) notFound()

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      promoCode: { select: { code: true } },
    },
  })

  if (!order) notFound()

  // C2: token-валидация. Раньше страница отдавала PII (имя/email/телефон/состав)
  // по любому правильному orderNumber — формат MC-DDMMYY-XXXX (4 случайных
  // символа) перебираем за разумное время. Теперь требуется ИЛИ валидный token,
  // ИЛИ совпадение userId сессии с владельцем заказа. Без этого 404 — не
  // сообщаем атакующему, что заказ существует.
  const session = await auth()
  const sessionUserId =
    session?.user?.id &&
    (session.user as Record<string, unknown>).userType === "customer"
      ? session.user.id
      : null
  // Админ видит любой заказ — у админа отдельный путь /admin/orders/[id],
  // но если сюда попал — пускаем для удобства (он не атакующий).
  const isAdmin =
    session?.user &&
    (session.user as Record<string, unknown>).userType === "admin"

  const tokenMatches =
    !!token && !!order.thankYouToken && token === order.thankYouToken
  const ownsOrder = !!sessionUserId && order.userId === sessionUserId
  const allowed = tokenMatches || ownsOrder || !!isAdmin
  if (!allowed) notFound()

  // Yandex Metrica goal "purchase" триггерится только при первом валидном
  // переходе с token (после оплаты). Refresh уже не должен слать дубль
  // конверсии в счётчик — поэтому token потребляется (one-time use).
  let shouldTrack = false
  if (tokenMatches) {
    shouldTrack = true
    await prisma.order.update({
      where: { id: order.id },
      data: { thankYouToken: null },
    })
  }

  return (
    <>
      <Header />
      <main className="pt-20 sm:pt-24 pb-12 sm:pb-16 min-h-screen bg-secondary/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <ThankYouContent
            shouldTrack={shouldTrack}
            paymentStatus={order.paymentStatus}
            order={{
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              customerEmail: order.customerEmail,
              customerPhone: order.customerPhone,
              subtotal: order.subtotal,
              discount: order.discount,
              deliveryPrice: order.deliveryPrice,
              total: order.total,
              promoCode: order.promoCode?.code ?? null,
              giftName: order.giftNameSnapshot,
              items: order.items.map((item) => ({
                name: item.name,
                weight: item.weight,
                price: item.price,
                quantity: item.quantity,
              })),
            }}
          />
        </div>
      </main>
      <Footer />
    </>
  )
}
