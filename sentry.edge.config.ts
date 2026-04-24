import * as Sentry from "@sentry/nextjs"

const dsn = process.env.SENTRY_DSN

// Edge runtime (middleware) — минимальная инициализация, т.к. тут нет
// node-apis. В основном нужен чтобы captured exceptions из middleware
// тоже попадали в Sentry.
if (dsn && process.env.NODE_ENV === "production") {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV,
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
  })
}
