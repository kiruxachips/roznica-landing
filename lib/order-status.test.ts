import { describe, it, expect } from "vitest"
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  isOrderStatus,
  isPaymentStatus,
  parseOrderStatus,
  parsePaymentStatus,
  canTransition,
  ALLOWED_STATUS_TRANSITIONS,
} from "./order-status"

describe("order-status", () => {
  it("валидный OrderStatus распознаётся", () => {
    for (const s of ORDER_STATUSES) {
      expect(isOrderStatus(s)).toBe(true)
    }
  })

  it("неваливный строковый статус отсекается", () => {
    expect(isOrderStatus("shipping")).toBe(false)
    expect(isOrderStatus("DELIVERED")).toBe(false) // case-sensitive
    expect(isOrderStatus("")).toBe(false)
    expect(isOrderStatus(null)).toBe(false)
    expect(isOrderStatus(undefined)).toBe(false)
    expect(isOrderStatus(42)).toBe(false)
  })

  it("parseOrderStatus бросает на невалидных", () => {
    expect(() => parseOrderStatus("wrong")).toThrow()
    expect(parseOrderStatus("pending")).toBe("pending")
  })

  it("PaymentStatus: canceled с одной 'l' (ЮKassa-стиль)", () => {
    expect(isPaymentStatus("canceled")).toBe(true)
    expect(isPaymentStatus("cancelled")).toBe(false)
    expect(() => parsePaymentStatus("cancelled")).toThrow()
  })

  it("terminal-статусы не имеют transitions", () => {
    expect(ALLOWED_STATUS_TRANSITIONS.cancelled).toEqual([])
    expect(ALLOWED_STATUS_TRANSITIONS.returned).toEqual([])
  })

  it("canTransition работает", () => {
    expect(canTransition("pending", "paid")).toBe(true)
    expect(canTransition("pending", "delivered")).toBe(false)
    expect(canTransition("delivered", "pending")).toBe(false)
    expect(canTransition("payment_failed", "pending")).toBe(true)
  })

  it("все ORDER_STATUSES имеют запись в ALLOWED_STATUS_TRANSITIONS", () => {
    for (const s of ORDER_STATUSES) {
      expect(ALLOWED_STATUS_TRANSITIONS).toHaveProperty(s)
    }
  })

  it("PAYMENT_STATUSES исчерпывающий", () => {
    expect(PAYMENT_STATUSES).toEqual(["pending", "succeeded", "canceled", "refunded"])
  })
})
