import type { Metadata } from "next"
import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { confirmAccountDeletion } from "@/lib/actions/account-delete"

export const metadata: Metadata = {
  title: "Подтверждение удаления | Millor Coffee",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

/**
 * Страница-приёмник ссылки из email. Юзер залогинен → выполняем
 * анонимизацию + logout, редиректим на главную.
 *
 * Если юзер НЕ залогинен (открыл ссылку на другом устройстве) — покажем
 * форму входа с объяснением.
 */
export default async function ConfirmDeletionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const session = await auth()
  const sp = await searchParams
  const token = sp.token

  if (!token) {
    return (
      <main className="container mx-auto max-w-xl px-4 py-8">
        <h1 className="text-2xl font-bold mb-3">Неверная ссылка</h1>
        <p className="text-sm text-muted-foreground mb-4">
          В ссылке отсутствует токен. Попробуйте перейти снова из письма или запросить новую
          ссылку через /account/delete.
        </p>
        <Link href="/account" className="text-primary hover:underline text-sm">
          ← В аккаунт
        </Link>
      </main>
    )
  }

  if (!session?.user?.id) {
    const next = `/account/delete/confirm?token=${encodeURIComponent(token)}`
    redirect(`/auth/login?next=${encodeURIComponent(next)}`)
  }

  async function handleConfirm() {
    "use server"
    if (!token) return
    const result = await confirmAccountDeletion(token)
    if (!result.success) {
      redirect(
        `/account/delete/confirm?token=${encodeURIComponent(token)}&error=${encodeURIComponent(
          result.error ?? "Не удалось"
        )}`
      )
    }
    // Успех — confirmAccountDeletion сам редиректит на "/".
  }

  return (
    <main className="container mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-3">Последнее подтверждение</h1>

      {sp.error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800 mb-4">
          {sp.error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
        <p className="text-sm">
          Нажимая кнопку ниже, вы подтверждаете удаление аккаунта. Это действие{" "}
          <strong>необратимо</strong>.
        </p>

        <form action={handleConfirm} className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/account"
            className="h-11 px-5 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center"
          >
            Передумал
          </Link>
          <button
            type="submit"
            className="flex-1 h-11 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Удалить аккаунт окончательно
          </button>
        </form>
      </div>
    </main>
  )
}
