/**
 * Простой circuit breaker для защиты от cascade failures при падении
 * внешних API. Реализован in-memory — для single-instance deployment ок;
 * при scale на несколько нод — мигрировать на Redis.
 *
 * Состояния:
 *   - closed (нормальное): запросы идут, ошибки считаются.
 *   - open: все запросы мгновенно падают с CircuitBreakerOpenError
 *     пока cooldownMs не истечёт.
 *   - half-open (не реализовано явно): после cooldown первый запрос
 *     вручную open/closed (probe-вызов).
 *
 * Использование:
 *   const cdekBreaker = createCircuitBreaker({
 *     name: "cdek",
 *     failureThreshold: 5,
 *     windowMs: 60_000,
 *     cooldownMs: 5 * 60_000,
 *   })
 *   const rates = await cdekBreaker.run(() => fetchCdekRates(...))
 */

export class CircuitBreakerOpenError extends Error {
  constructor(public breakerName: string, public retryAt: Date) {
    super(`Circuit "${breakerName}" is OPEN. Retry after ${retryAt.toISOString()}.`)
    this.name = "CircuitBreakerOpenError"
  }
}

interface BreakerConfig {
  name: string
  /** Количество подряд идущих ошибок в окне, после которого circuit открывается. */
  failureThreshold: number
  /** Окно (ms), в котором считаются подряд идущие ошибки. */
  windowMs: number
  /** Сколько держать circuit открытым (ms) до попытки probe. */
  cooldownMs: number
}

interface BreakerState {
  failures: { at: number }[]
  openUntil: number | null
}

export interface CircuitBreaker {
  run<T>(fn: () => Promise<T>): Promise<T>
  status(): { state: "closed" | "open"; failures: number; openUntil: Date | null }
  reset(): void
}

export function createCircuitBreaker(config: BreakerConfig): CircuitBreaker {
  const state: BreakerState = { failures: [], openUntil: null }

  function pruneOldFailures() {
    const cutoff = Date.now() - config.windowMs
    state.failures = state.failures.filter((f) => f.at > cutoff)
  }

  function isOpen(): boolean {
    if (state.openUntil === null) return false
    if (Date.now() >= state.openUntil) {
      // cooldown истёк — возвращаемся в closed, сбрасываем counters
      state.openUntil = null
      state.failures = []
      return false
    }
    return true
  }

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (isOpen()) {
        throw new CircuitBreakerOpenError(config.name, new Date(state.openUntil!))
      }

      try {
        const result = await fn()
        // На успехе обнуляем счётчик — мы не хотим накапливать старые ошибки.
        state.failures = []
        return result
      } catch (err) {
        state.failures.push({ at: Date.now() })
        pruneOldFailures()
        if (state.failures.length >= config.failureThreshold) {
          state.openUntil = Date.now() + config.cooldownMs
          // Логируем через pino: в логах появится "circuit opened" → видно в Sentry
          console.error(
            `[circuit:${config.name}] OPENED after ${state.failures.length} failures in ${config.windowMs}ms window. Cooldown ${config.cooldownMs}ms.`
          )
        }
        throw err
      }
    },

    status() {
      pruneOldFailures()
      return {
        state: isOpen() ? "open" : "closed",
        failures: state.failures.length,
        openUntil: state.openUntil ? new Date(state.openUntil) : null,
      }
    },

    reset() {
      state.failures = []
      state.openUntil = null
    },
  }
}
