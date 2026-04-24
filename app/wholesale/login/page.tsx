import { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { WholesaleLoginForm } from "@/components/wholesale/LoginForm"

export const metadata: Metadata = {
  title: "Вход в оптовый кабинет | Millor Coffee",
  robots: { index: false, follow: false },
}

export default function WholesaleLoginPage() {
  return (
    <div className="container mx-auto px-4 max-w-md">
      <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
        <h1 className="font-serif text-2xl sm:text-3xl font-bold mb-2">Вход для оптовиков</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Ещё нет аккаунта?{" "}
          <Link href="/wholesale/register" className="text-primary font-medium hover:underline">
            Зарегистрироваться за минуту
          </Link>{" "}
          — без заявок и согласований.
        </p>
        <Suspense>
          <WholesaleLoginForm />
        </Suspense>

        <div className="mt-6 pt-6 border-t border-border">
          <Link
            href="/wholesale/register"
            className="flex items-center justify-center rounded-xl bg-primary/10 text-primary font-medium py-2.5 hover:bg-primary/15 transition-colors"
          >
            Зарегистрироваться как оптовик →
          </Link>
        </div>
      </div>
    </div>
  )
}
