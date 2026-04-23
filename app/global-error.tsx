"use client"

/**
 * Глобальный error-boundary для ошибок на уровне root layout.
 * Next.js показывает эту страницу при критических ошибках (краш layout.tsx,
 * недоступность БД на старте). Обязан рендерить <html>/<body> сам.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  if (typeof console !== "undefined") {
    console.error("Global error:", error)
  }

  return (
    <html lang="ru">
      <body
        style={{
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f5f7f6",
          color: "#1a1f1c",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            background: "#fff",
            borderRadius: 16,
            padding: "40px 24px",
            textAlign: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
          }}
        >
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>
            Что-то пошло не так
          </h1>
          <p style={{ color: "#666", marginBottom: 24, fontSize: 15, lineHeight: 1.5 }}>
            Мы уже получили уведомление и занимаемся проблемой. Попробуйте
            обновить страницу — чаще всего этого достаточно.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                padding: "12px 24px",
                background: "#2d6b4a",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Попробовать снова
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                padding: "12px 24px",
                border: "1px solid #dfe4e0",
                color: "#1a1f1c",
                textDecoration: "none",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 500,
                display: "inline-block",
              }}
            >
              На главную
            </a>
          </div>
          {error.digest && (
            <p style={{ fontSize: 12, color: "#999", marginTop: 20 }}>
              Код ошибки: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
