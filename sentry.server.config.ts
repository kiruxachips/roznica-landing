import * as Sentry from "@sentry/nextjs"

const dsn = process.env.SENTRY_DSN
const env = process.env.NODE_ENV

if (dsn && env === "production") {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV || env,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    // Отсекаем шум который не требует расследования
    ignoreErrors: [
      // NextAuth throws redirects — это feature, не баг
      "NEXT_REDIRECT",
      "NEXT_NOT_FOUND",
    ],
    beforeSend(event) {
      // Маскируем email в breadcrumbs/exceptions на уровне сервера —
      // страховка на случай если логгер раньше Sentry записал что-то лишнее.
      if (event.exception?.values) {
        for (const e of event.exception.values) {
          if (e.value) {
            e.value = e.value.replace(
              /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
              "***@***"
            )
          }
        }
      }
      return event
    },
  })
}
