"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

const ALLOWED_INTERVALS = [14, 21, 30] as const
type AllowedInterval = (typeof ALLOWED_INTERVALS)[number]

async function requireCustomer(): Promise<string> {
  const session = await auth()
  const userId = session?.user?.id
  const userType = (session?.user as Record<string, unknown> | undefined)?.userType
  if (!userId || userType !== "customer") {
    throw new Error("Не авторизован")
  }
  return userId
}

export async function createSubscription(data: {
  variantId: string
  quantity: number
  intervalDays: number
  deliveryAddressSnapshot?: Record<string, unknown>
}): Promise<{ ok: boolean; error?: string; id?: string }> {
  const userId = await requireCustomer()

  const intervalDays = Math.floor(data.intervalDays)
  if (!(ALLOWED_INTERVALS as readonly number[]).includes(intervalDays)) {
    return { ok: false, error: "Недопустимая периодичность" }
  }
  if (!data.quantity || data.quantity < 1 || data.quantity > 10) {
    return { ok: false, error: "Количество вне диапазона 1-10" }
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: data.variantId },
    select: { isActive: true, product: { select: { isActive: true } } },
  })
  if (!variant?.isActive || !variant.product.isActive) {
    return { ok: false, error: "Товар недоступен для подписки" }
  }

  const nextDeliveryDate = new Date(Date.now() + intervalDays * 86_400_000)

  const created = await prisma.subscription.create({
    data: {
      userId,
      variantId: data.variantId,
      quantity: data.quantity,
      intervalDays: intervalDays as AllowedInterval,
      discountPercent: 5,
      status: "active",
      nextDeliveryDate,
      // Prisma JsonNullable — передаём строкой JSON через serialize
      // для совместимости с Prisma.JsonValue union.
      deliveryAddressSnapshot: data.deliveryAddressSnapshot
        ? JSON.parse(JSON.stringify(data.deliveryAddressSnapshot))
        : undefined,
    },
  })

  revalidatePath("/account/subscriptions")
  return { ok: true, id: created.id }
}

export async function pauseSubscription(
  id: string,
  untilDate: Date | null
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireCustomer()
  const sub = await prisma.subscription.findUnique({ where: { id } })
  if (!sub || sub.userId !== userId) return { ok: false, error: "Не найдена" }
  if (sub.status === "cancelled") return { ok: false, error: "Подписка отменена" }

  await prisma.subscription.update({
    where: { id },
    data: {
      status: "paused",
      pausedUntil: untilDate,
    },
  })
  revalidatePath("/account/subscriptions")
  return { ok: true }
}

export async function resumeSubscription(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireCustomer()
  const sub = await prisma.subscription.findUnique({ where: { id } })
  if (!sub || sub.userId !== userId) return { ok: false, error: "Не найдена" }
  if (sub.status !== "paused") return { ok: false, error: "Подписка не приостановлена" }

  // Сдвигаем nextDeliveryDate — если пауза закончилась позже запланированной
  // даты, делаем ближайшую следующую.
  const nextDelivery =
    sub.pausedUntil && sub.pausedUntil > sub.nextDeliveryDate
      ? sub.pausedUntil
      : sub.nextDeliveryDate

  await prisma.subscription.update({
    where: { id },
    data: {
      status: "active",
      pausedUntil: null,
      nextDeliveryDate: nextDelivery,
    },
  })
  revalidatePath("/account/subscriptions")
  return { ok: true }
}

export async function cancelSubscription(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const userId = await requireCustomer()
  const sub = await prisma.subscription.findUnique({ where: { id } })
  if (!sub || sub.userId !== userId) return { ok: false, error: "Не найдена" }
  if (sub.status === "cancelled") return { ok: true }

  await prisma.subscription.update({
    where: { id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
    },
  })
  revalidatePath("/account/subscriptions")
  return { ok: true }
}
