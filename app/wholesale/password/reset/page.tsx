import { Metadata } from "next"
import Link from "next/link"
import { WholesalePasswordResetForm } from "@/components/wholesale/PasswordResetForm"

export const metadata: Metadata = {
  title: "Сброс пароля | Оптовый кабинет",
  robots: { index: false, follow: false },
}

export default function WholesalePasswordResetPage() {
  return (
    <div className="container mx-auto px-4 max-w-md">
      <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
        <h1 className="font-serif text-2xl font-bold mb-2">Сброс пароля</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Введите email — отправим код для установки нового пароля. Если не получится —{" "}
          <Link href="/wholesale/login" className="text-primary hover:underline">
            вернуться к входу
          </Link>.
        </p>
        <WholesalePasswordResetForm />
      </div>
    </div>
  )
}
