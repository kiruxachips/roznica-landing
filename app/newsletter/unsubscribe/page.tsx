import type { Metadata } from "next"
import Link from "next/link"
import { unsubscribeByToken } from "@/lib/actions/newsletter"

export const metadata: Metadata = {
  title: "Отписка от рассылки | Millor Coffee",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

/**
 * Страница one-click отписки. Принимает ?token=xxx из ссылки в письме.
 * Не требует логина — нужно чтобы работало прямо из Gmail/Яндекс.Почты.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const sp = await searchParams
  const token = sp.token || ""

  const result = token
    ? await unsubscribeByToken(token)
    : { ok: false, error: "В ссылке отсутствует токен" }

  return (
    <main className="container mx-auto max-w-xl px-4 py-16 text-center">
      {result.ok ? (
        <>
          <h1 className="text-2xl font-bold mb-3">Вы отписались от рассылки</h1>
          <p className="text-muted-foreground mb-6">
            {result.email ? (
              <>
                Адрес <strong>{result.email}</strong> больше не будет получать
                наши письма.
              </>
            ) : (
              "Мы больше не будем вам писать."
            )}
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Если отписались случайно — вернитесь через форму на сайте.
          </p>
          <Link
            href="/"
            className="inline-block px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            На главную
          </Link>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold mb-3">Ссылка недействительна</h1>
          <p className="text-muted-foreground mb-8">
            {result.error || "Возможно, вы уже отписались ранее."}
          </p>
          <Link href="/" className="text-primary hover:underline text-sm">
            ← На главную
          </Link>
        </>
      )}
    </main>
  )
}
