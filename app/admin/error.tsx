"use client"

import Link from "next/link"
import { useEffect } from "react"

/**
 * Admin error-boundary. В prod скрываем stack-trace (только digest-id).
 * Logger'ом дублируем в Sentry через instrumentation.onRequestError.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[admin-page]", error)
  }, [error])

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-2xl font-bold mb-2">Что-то пошло не так</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Страница не загрузилась. Мы уже получили уведомление об ошибке.
        {error.digest && (
          <>
            {" "}ID ошибки: <code className="font-mono bg-muted px-1 py-0.5 rounded">{error.digest}</code>
          </>
        )}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
        >
          Попробовать снова
        </button>
        <Link
          href="/admin"
          className="px-4 py-2 border border-border rounded-lg text-sm"
        >
          На дашборд
        </Link>
      </div>
    </div>
  )
}
