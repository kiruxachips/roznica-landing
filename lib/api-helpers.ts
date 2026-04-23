import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, type RateLimitOptions } from "@/lib/rate-limit"

/**
 * Извлекает client IP из reverse-proxy headers. На Beget идёт через nginx,
 * который проставляет X-Forwarded-For первым значением.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]!.trim()
  return request.headers.get("x-real-ip") || "unknown"
}

/**
 * Обёртка для public-endpoint'ов с rate-limit по IP. Использование:
 *
 *   export const POST = withRateLimit(async (req) => { ... }, RATE_LIMITS.deliveryApi)
 *
 * Возвращает 429 с Retry-After при превышении порога. Счётчик ключуется
 * по тэгу (name эндпоинта) + IP.
 */
export function withRateLimit<T extends (req: NextRequest, ...args: never[]) => Promise<Response>>(
  handler: T,
  opts: RateLimitOptions & { tag: string }
): T {
  return (async (req: NextRequest, ...rest: never[]) => {
    const ip = getClientIp(req)
    const rl = checkRateLimit(`${opts.tag}:${ip}`, opts)
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(rl.retryAfter ?? 60),
          },
        }
      )
    }
    return handler(req, ...rest)
  }) as T
}

// Preset'ы для public delivery API — публичные endpoint'ы, которые ходят
// во внешние сервисы (СДЭК, DaData, Pochta, Yandex Maps). Щедро, чтобы
// legitimate UX не страдал, но защита от burst-DoS есть.
export const DELIVERY_RATE_LIMIT = {
  tag: "delivery-api",
  max: 60,
  windowMs: 60 * 1000,
  blockMs: 5 * 60 * 1000,
}
