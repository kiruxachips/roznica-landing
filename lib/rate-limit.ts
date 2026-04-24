/**
 * In-memory rate limiter для single-instance Docker-деплоя.
 * При рестарте контейнера счётчики обнуляются — приемлемо, т.к. атакующий
 * всё равно не сможет уложить бесконечный шквал: SMTP-тайминги, bcrypt
 * (100ms+ per attempt) и обычный пропуск PM2 между рестартами естественно
 * ограничивают. Если появится horizontal scale — перевести на Redis.
 *
 * Политика: window-based counter. В заданном окне (напр. 5 минут) накапливаем
 * попытки; на превышении `max` блокируем на `blockDuration` секунд.
 *
 * Использование:
 *   const { allowed, retryAfter } = checkRateLimit("login:" + email + ":" + ip)
 *   if (!allowed) return NextResponse.json({ error: "..." }, { status: 429, headers: { "Retry-After": retryAfter } })
 */

interface Entry {
  attempts: number
  windowStart: number
  blockedUntil?: number
}

const store = new Map<string, Entry>()

// Cleanup каждые 10 минут — удаляем записи, чей window и block истекли,
// чтобы Map не рос бесконечно при уникальных ключах.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000
let cleanupTimer: NodeJS.Timeout | null = null
function ensureCleanup() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      const expired =
        (entry.blockedUntil === undefined && now - entry.windowStart > 60 * 60 * 1000) ||
        (entry.blockedUntil !== undefined && entry.blockedUntil < now)
      if (expired) store.delete(key)
    }
  }, CLEANUP_INTERVAL_MS)
  // На Node не даём таймеру держать event loop
  if (typeof cleanupTimer.unref === "function") cleanupTimer.unref()
}

export interface RateLimitOptions {
  /** Максимум попыток в окне */
  max: number
  /** Размер окна в миллисекундах */
  windowMs: number
  /** Сколько миллисекунд блокировать после превышения */
  blockMs: number
}

export interface RateLimitResult {
  allowed: boolean
  /** Сколько попыток осталось (0 если заблокирован) */
  remaining: number
  /** Секунд до разблокировки (undefined если allowed=true) */
  retryAfter?: number
}

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  ensureCleanup()
  const now = Date.now()
  const entry = store.get(key)

  // Blocked — проверяем не истёк ли блок
  if (entry?.blockedUntil !== undefined) {
    if (entry.blockedUntil > now) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
      }
    }
    // Блок истёк — начинаем новое окно
    store.set(key, { attempts: 0, windowStart: now })
  }

  const current = store.get(key)
  // Окно истекло — сбрасываем
  if (!current || now - current.windowStart > opts.windowMs) {
    store.set(key, { attempts: 0, windowStart: now })
  }

  const e = store.get(key)!
  e.attempts++

  if (e.attempts > opts.max) {
    e.blockedUntil = now + opts.blockMs
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(opts.blockMs / 1000),
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, opts.max - e.attempts),
  }
}

/**
 * Успешный запрос — сбрасывает счётчик, чтобы успешный логин не блокировал
 * следующий попытки если юзер вдруг опечатался пароль после успеха.
 */
export function resetRateLimit(key: string): void {
  store.delete(key)
}

// Preset'ы для частых сценариев
export const RATE_LIMITS = {
  /** Логин credentials — 5 попыток / 5 мин, блок 15 мин */
  login: { max: 5, windowMs: 5 * 60 * 1000, blockMs: 15 * 60 * 1000 },
  /** OAuth callback per IP — 20 попыток / 5 мин, блок 30 мин */
  oauthCallback: { max: 20, windowMs: 5 * 60 * 1000, blockMs: 30 * 60 * 1000 },
  /** Публичные email-endpoint'ы (newsletter, abandoned-cart track) —
   * защита от спама чужих email'ов. 10/мин на IP + email комбинацию. */
  publicEmailAction: {
    max: 10,
    windowMs: 60 * 1000,
    blockMs: 30 * 60 * 1000,
  },
} as const
