import { Metadata } from "next"
import Link from "next/link"
import { WholesaleRegisterForm } from "@/components/wholesale/RegisterForm"

export const metadata: Metadata = {
  title: "Заявка на оптовый доступ | Millor Coffee",
  robots: { index: false, follow: false },
}

export default function WholesaleRegisterPage() {
  return (
    <div className="container mx-auto px-4 max-w-2xl">
      <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">Заявка на оптовый доступ</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Мы свяжемся с вами в течение рабочего дня. Если уже работаете с нами и забыли пароль —{" "}
          <Link href="/wholesale/login" className="text-primary hover:underline">
            войдите
          </Link>.
        </p>
        <WholesaleRegisterForm />
      </div>
    </div>
  )
}
