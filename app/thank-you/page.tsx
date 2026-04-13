import { Metadata } from "next"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { ThankYouContent } from "./ThankYouContent"
import { prisma } from "@/lib/prisma"

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

  // Verify token and consume it (one-time use)
  let shouldTrack = false
  if (token && order.thankYouToken && token === order.thankYouToken) {
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
