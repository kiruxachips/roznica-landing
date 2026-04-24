import * as Sentry from "@sentry/nextjs"

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const env = process.env.NODE_ENV

// Инициализируем только в production и если DSN задан.
// В dev шумит false-positive на hot-reload и перезапусках.
if (dsn && env === "production") {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENV || env,
    // Sample rate — в проде 10% транзакций, остальное можно собрать через
    // replay при необходимости. Пока без replay (платное).
    tracesSampleRate: 0.1,
    // Не отправлять PII по умолчанию — client может случайно залить
    // email/phone из форм в breadcrumbs.
    sendDefaultPii: false,
    // Game-changer для платного плана: игнорируем шум от расширений
    // браузера и сторонних скриптов, который не наш код.
    ignoreErrors: [
      /ResizeObserver loop/i,
      /Non-Error promise rejection captured/i,
      /Loading chunk \d+ failed/i,
      /Load failed/i,
    ],
  })
}
