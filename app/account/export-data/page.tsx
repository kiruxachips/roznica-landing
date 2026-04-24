import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"

export const metadata: Metadata = {
  title: "Экспорт данных | Millor Coffee",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function ExportDataPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  return (
    <main className="container mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-3">Экспорт моих данных</h1>
      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
        <p className="text-sm">
          Вы можете скачать все свои персональные данные в формате JSON. Это
          гарантировано 152-ФЗ ст. 14.
        </p>

        <p className="text-sm">В файл войдут:</p>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
          <li>Профиль (имя, email, телефон, адреса)</li>
          <li>История заказов со составом</li>
          <li>Бонусные транзакции</li>
          <li>Даты согласий на обработку ПД</li>
          <li>Избранные товары</li>
        </ul>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link
            href="/account/profile"
            className="h-11 px-5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center"
          >
            Назад
          </Link>
          <a
            href="/api/account/export-data"
            download
            className="flex-1 h-11 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center"
          >
            Скачать JSON
          </a>
        </div>
      </div>
    </main>
  )
}
