import { z } from "zod"

/**
 * Единый источник правды для статусов Order и Payment.
 *
 * Решение: не использовать Prisma enum, а хранить как `String` в БД +
 * жёсткая валидация через Zod + constants + TS-union.
 *
 * Почему не Prisma enum:
 *   1. Переход требует dual-write миграцию (3 деплоя с backfill'ом).
 *   2. При текущем объёме данных (≤ 10k Order) опасность невалидных
 *      значений уже митигирована через ALLOWED_TRANSITIONS в DAL.
 *   3. Добавление нового статуса в enum — ALTER TYPE, требует координации
 *      с приложением; в String-варианте — просто дописать константу.
 *
 * Что защищает эта модель:
 *   - TS-союз не даёт написать опечатку в коде.
 *   - `parseOrderStatus` в webhook-хендлерах блокирует невалидные значения
 *     из внешних систем до записи в БД.
 *   - Центральная точка для всех переходов → легче аудитить.
 *
 * Когда перейти на Prisma enum: когда БД > 100k Order и миграция
 * стоит дороже чем постоянный runtime-check (редко случается).
 */

export const ORDER_STATUSES = [
  "pending", // заказ создан, ждёт оплаты/подтверждения
  "paid", // деньги получены, ждёт подтверждения
  "confirmed", // подтверждён, ждёт отгрузки
  "shipped", // передан в доставку
  "delivered", // получен клиентом
  "cancelled", // отменён до отгрузки (terminal)
  "payment_failed", // оплата не прошла, можно повторить
  "returned", // получен, возвращён (terminal, для будущего RMA-flow)
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const orderStatusSchema = z.enum(ORDER_STATUSES)

export function isOrderStatus(v: unknown): v is OrderStatus {
  return typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v)
}

export function parseOrderStatus(v: unknown): OrderStatus {
  return orderStatusSchema.parse(v)
}

// --- Payment ---

export const PAYMENT_STATUSES = [
  "pending",
  "succeeded",
  "canceled", // именно canceled (один 'l') — так в ЮKassa API
  "refunded",
] as const

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const paymentStatusSchema = z.enum(PAYMENT_STATUSES)

export function isPaymentStatus(v: unknown): v is PaymentStatus {
  return typeof v === "string" && (PAYMENT_STATUSES as readonly string[]).includes(v)
}

export function parsePaymentStatus(v: unknown): PaymentStatus {
  return paymentStatusSchema.parse(v)
}

// --- Transitions ---
// Дублирует ALLOWED_TRANSITIONS в lib/dal/orders.ts. После того как
// migrate-скрипт подтвердит полную согласованность, DAL должен импортировать
// отсюда, а не держать свою копию.
export const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending: ["paid", "confirmed", "cancelled"],
  paid: ["confirmed", "shipped", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: ["returned"],
  cancelled: [],
  payment_failed: ["pending", "cancelled"],
  returned: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to)
}

// --- Email dispatch status ---

export const EMAIL_DISPATCH_STATUSES = ["pending", "sent", "failed", "dead"] as const
export type EmailDispatchStatus = (typeof EMAIL_DISPATCH_STATUSES)[number]
export const emailDispatchStatusSchema = z.enum(EMAIL_DISPATCH_STATUSES)

// --- Stock reasons ---
// Импортируется в lib/dal/stock.ts для единой точки валидации.
export const STOCK_REASONS = [
  "order_placed",
  "order_cancelled",
  "order_restored",
  "supplier_received",
  "inventory_correction",
  "write_off",
  "gifted",
  "gift_returned",
  "shrinkage",
] as const

export type StockReason = (typeof STOCK_REASONS)[number]
export const stockReasonSchema = z.enum(STOCK_REASONS)
