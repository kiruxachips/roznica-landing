import { Metadata } from "next"
import { Suspense } from "react"
import { WholesalePasswordResetConfirmForm } from "@/components/wholesale/PasswordResetConfirmForm"

export const metadata: Metadata = {
  title: "Установка нового пароля | Оптовый кабинет",
  robots: { index: false, follow: false },
}

export default function WholesalePasswordResetConfirmPage() {
  return (
    <div className="container mx-auto px-4 max-w-md">
      <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
        <h1 className="font-serif text-2xl font-bold mb-2">Новый пароль</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Введите код из письма и новый пароль.
        </p>
        <Suspense>
          <WholesalePasswordResetConfirmForm />
        </Suspense>
      </div>
    </div>
  )
}
