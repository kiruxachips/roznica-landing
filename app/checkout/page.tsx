import { Metadata } from "next"
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { CheckoutForm } from "@/components/checkout/CheckoutForm"

export const metadata: Metadata = {
  title: "Оформление заказа | Millor Coffee",
  robots: { index: false, follow: false },
}

export default function CheckoutPage() {
  return (
    <>
      <Header />
      <main className="pt-24 pb-16 bg-secondary/20 min-h-screen">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-serif text-3xl font-bold mb-8">Оформление заказа</h1>
          <CheckoutForm />
        </div>
      </main>
      <Footer />
    </>
  )
}
