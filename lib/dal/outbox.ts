import crypto from "crypto"
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

const DEAD_AFTER_ATTEMPTS = Number(process.env.OUTBOX_MAX_ATTEMPTS || 10)

export interface EnqueueOptions {
  eventId?: string
  scheduleAt?: Date
}

export async function enqueueOutbox(
  topic: string,
  payload: Prisma.InputJsonValue,
  opts: EnqueueOptions = {},
) {
  const eventId = opts.eventId ?? `evt_${crypto.randomUUID()}`
  return prisma.outboxEvent.create({
    data: {
      eventId,
      topic,
      payload,
      status: "pending",
      nextAttemptAt: opts.scheduleAt ?? new Date(),
    },
  })
}

export async function claimReadyOutbox(limit: number = 20) {
  return prisma.outboxEvent.findMany({
    where: {
      status: "pending",
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
  })
}

export async function markOutboxDelivered(id: string, response: Prisma.InputJsonValue, statusCode: number) {
  return prisma.outboxEvent.update({
    where: { id },
    data: {
      status: "delivered",
      lastStatusCode: statusCode,
      deliveredAt: new Date(),
      lastError: null,
    },
  })
}

// Exponential backoff: 5s, 25s, 2m, 10m, 1h, 5h, 1d — capped.
function backoffSeconds(attempts: number): number {
  const base = 5
  const s = Math.min(base * Math.pow(5, attempts), 86400)
  return Math.floor(s)
}

export async function markOutboxFailed(
  id: string,
  attempts: number,
  error: string,
  statusCode: number | null,
) {
  const newAttempts = attempts + 1
  const isDead = newAttempts >= DEAD_AFTER_ATTEMPTS
  const nextAttemptAt = isDead ? null : new Date(Date.now() + backoffSeconds(newAttempts) * 1000)

  return prisma.outboxEvent.update({
    where: { id },
    data: {
      status: isDead ? "dead" : "pending",
      attempts: newAttempts,
      lastError: error.slice(0, 2000),
      lastStatusCode: statusCode,
      ...(nextAttemptAt ? { nextAttemptAt } : {}),
    },
  })
}

export async function retryDeadOutbox(id: string) {
  return prisma.outboxEvent.update({
    where: { id },
    data: {
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(),
      lastError: null,
    },
  })
}
