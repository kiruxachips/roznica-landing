import { Metadata } from "next"
import Link from "next/link"
import { WholesaleRegisterForm } from "@/components/wholesale/RegisterForm"

export const metadata: Metadata = {
  title: "Регистрация оптовика | Millor Coffee",
  robots: { index: false, follow: false },
}

export default function WholesaleRegisterPage() {
  return (
    <div className="container mx-auto px-4 max-w-2xl">
      <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">
          Регистрация для оптовиков
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Одна минута — и вы уже в кабинете. Никаких заявок и согласований: после регистрации
          сразу доступен каталог, корзина и оформление заказа со скидкой от общего веса.
          Уже есть аккаунт? <Link href="/wholesale/login" className="text-primary hover:underline">
            Войти
          </Link>.
        </p>
        <WholesaleRegisterForm />
      </div>
    </div>
  )
}
