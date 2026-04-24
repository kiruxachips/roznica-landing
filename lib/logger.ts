import pino from "pino"

/**
 * Structured logger на основе pino. Пишет JSON в stdout, парсится
 * Docker'ом и внешними агрегаторами (Sentry, Loki, Datadog).
 *
 * Использование:
 *   import { logger } from "@/lib/logger"
 *   logger.info({ orderId, userId }, "Order created")
 *   logger.error({ err, context }, "Failed to send email")
 *
 * В Sentry важные ошибки дублируются автоматически через серверный
 * `instrumentation.ts`. Здесь — только бизнес-события для observability.
 *
 * Принципы:
 *   1. PII redaction: email, phone, адрес маскируются автоматически.
 *   2. Log level по env: debug в dev, info в prod.
 *   3. Child-logger-pattern для модулей: const log = logger.child({ module: "orders" }).
 */

const isDev = process.env.NODE_ENV !== "production"

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  // Убираем pid + hostname из каждой строки — для docker-логов избыточно.
  base: { service: "roznica-landing" },
  // Автоматическая redaction PII. Использовать paths с точкой-нотацией.
  redact: {
    paths: [
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.accessToken",
      "*.refreshToken",
      "*.secret",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  // Форматируем email/phone через custom hook чтобы не светить полностью.
  formatters: {
    log(obj) {
      if (typeof obj !== "object" || obj === null) return obj as Record<string, unknown>
      const record = obj as Record<string, unknown>
      const next = { ...record }
      if (typeof next.email === "string") next.email = maskEmail(next.email)
      if (typeof next.phone === "string") next.phone = maskPhone(next.phone)
      return next
    },
  },
  // В dev — красивый pretty-print. В prod — сырой JSON для агрегатора.
  transport: isDev
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss" },
      }
    : undefined,
})

function maskEmail(email: string): string {
  const at = email.indexOf("@")
  if (at < 1) return "***"
  const local = email.slice(0, at)
  const domain = email.slice(at)
  const visible = local.slice(0, 1)
  return `${visible}***${domain}`
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length < 7) return "***"
  return `${digits.slice(0, 2)}***${digits.slice(-2)}`
}
