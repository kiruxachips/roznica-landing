import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { requestAccountDeletion } from "@/lib/actions/account-delete"

export const metadata: Metadata = {
  title: "Удалить аккаунт | Millor Coffee",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function AccountDeletePage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const sp = await searchParams
  const emailSent = sp.sent === "1"

  async function handleRequest() {
    "use server"
    const result = await requestAccountDeletion()
    if (!result.success) {
      redirect(
        `/account/delete?error=${encodeURIComponent(result.error ?? "Неизвестная ошибка")}`
      )
    }
    redirect("/account/delete?sent=1")
  }

  return (
    <main className="container mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-3">Удалить аккаунт</h1>

      {emailSent ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <p className="font-medium text-green-900 mb-2">
            Мы отправили вам письмо со ссылкой подтверждения.
          </p>
          <p className="text-sm text-green-800">
            Проверьте почту (включая папку «Спам»). Ссылка действует 24 часа.
            Если письмо не пришло в течение 5 минут — обратитесь в поддержку.
          </p>
          <Link
            href="/account"
            className="inline-block mt-4 text-sm text-primary hover:underline"
          >
            ← Вернуться в аккаунт
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
            <p className="font-medium text-amber-900 mb-1">Это действие необратимо.</p>
            <ul className="list-disc list-inside text-amber-800 space-y-0.5">
              <li>Имя, email и телефон будут анонимизированы.</li>
              <li>Войти в этот аккаунт станет невозможно.</li>
              <li>История заказов останется для бухгалтерской отчётности, но без привязки к вам.</li>
              <li>Накопленные бонусы будут аннулированы.</li>
            </ul>
          </div>

          <p className="text-sm text-muted-foreground">
            Для безопасности мы отправим ссылку подтверждения на ваш email.
            Удаление произойдёт только после клика по ссылке в письме.
          </p>

          <form action={handleRequest} className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              className="h-11 px-5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Отправить подтверждение на email
            </button>
            <Link
              href="/account"
              className="flex-1 h-11 px-5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center"
            >
              Отмена
            </Link>
          </form>
        </div>
      )}
    </main>
  )
}
