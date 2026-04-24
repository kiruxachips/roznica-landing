import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createCircuitBreaker, CircuitBreakerOpenError } from "./circuit-breaker"

describe("circuit-breaker", () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it("closed при успешных вызовах", async () => {
    const cb = createCircuitBreaker({
      name: "test",
      failureThreshold: 3,
      windowMs: 1000,
      cooldownMs: 5000,
    })
    await cb.run(async () => "ok")
    await cb.run(async () => "ok")
    expect(cb.status().state).toBe("closed")
  })

  it("opens после N подряд фейлов", async () => {
    const cb = createCircuitBreaker({
      name: "test",
      failureThreshold: 3,
      windowMs: 1000,
      cooldownMs: 5000,
    })

    const fail = () => Promise.reject(new Error("boom"))
    for (let i = 0; i < 3; i++) {
      await expect(cb.run(fail)).rejects.toThrow("boom")
    }

    // 4-я попытка мгновенно падает с CircuitBreakerOpenError,
    // даже не вызывая fn.
    const spy = vi.fn(fail)
    await expect(cb.run(spy)).rejects.toBeInstanceOf(CircuitBreakerOpenError)
    expect(spy).not.toHaveBeenCalled()
  })

  it("закрывается обратно после cooldown'а", async () => {
    const cb = createCircuitBreaker({
      name: "test",
      failureThreshold: 2,
      windowMs: 1000,
      cooldownMs: 5000,
    })
    const fail = () => Promise.reject(new Error("boom"))
    await expect(cb.run(fail)).rejects.toThrow()
    await expect(cb.run(fail)).rejects.toThrow()
    // Теперь open
    expect(cb.status().state).toBe("open")

    // Через cooldown — снова closed.
    vi.advanceTimersByTime(5001)
    expect(cb.status().state).toBe("closed")

    // И fn опять вызывается.
    const spy = vi.fn(async () => "ok")
    await cb.run(spy)
    expect(spy).toHaveBeenCalled()
  })

  it("успешный запрос обнуляет счётчик failures", async () => {
    const cb = createCircuitBreaker({
      name: "test",
      failureThreshold: 3,
      windowMs: 1000,
      cooldownMs: 5000,
    })
    await expect(cb.run(() => Promise.reject(new Error("x")))).rejects.toThrow()
    await expect(cb.run(() => Promise.reject(new Error("x")))).rejects.toThrow()
    // 2 фейла. Успешный сбрасывает.
    await cb.run(async () => "ok")
    // Теперь 2 следующих фейла НЕ открывают circuit (нужно 3 подряд).
    await expect(cb.run(() => Promise.reject(new Error("x")))).rejects.toThrow()
    await expect(cb.run(() => Promise.reject(new Error("x")))).rejects.toThrow()
    expect(cb.status().state).toBe("closed")
  })

  it("reset вручную сбрасывает всё", async () => {
    const cb = createCircuitBreaker({
      name: "test",
      failureThreshold: 2,
      windowMs: 1000,
      cooldownMs: 5000,
    })
    const fail = () => Promise.reject(new Error("x"))
    await expect(cb.run(fail)).rejects.toThrow()
    await expect(cb.run(fail)).rejects.toThrow()
    expect(cb.status().state).toBe("open")
    cb.reset()
    expect(cb.status().state).toBe("closed")
  })
})
