import { Metadata } from "next"
import Link from "next/link"
import { CheckCircle } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"

export const metadata: Metadata = {
  title: "Заказ принят | Millor Coffee",
  robots: { index: false, follow: false },
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const params = await searchParams
  const orderNumber = params.order

  return (
    <>
      <Header />
      <main className="pt-24 pb-16 min-h-screen flex items-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-md mx-auto text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>

            <h1 className="font-serif text-3xl font-bold mb-4">Заказ принят!</h1>

            {orderNumber && (
              <p className="text-lg text-muted-foreground mb-2">
                Номер заказа: <span className="font-semibold text-foreground">{orderNumber}</span>
              </p>
            )}

            <p className="text-muted-foreground mb-8">
              Мы свяжемся с вами в ближайшее время для подтверждения заказа.
              Обычно это занимает не более 1-2 часов в рабочее время.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/catalog"
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                Продолжить покупки
              </Link>
              <Link
                href="/"
                className="px-6 py-3 border border-border rounded-xl font-medium hover:bg-muted transition-colors"
              >
                На главную
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
