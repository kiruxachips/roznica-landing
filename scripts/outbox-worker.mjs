// Outbox worker: drains OutboxEvent table and delivers events to millorbot.
// Standalone Node process (no Next.js runtime). Uses @prisma/client directly.
//
// ENV:
//   DATABASE_URL              required
//   MILLORBOT_ENABLED         "true" to deliver; otherwise events stay pending
//   MILLORBOT_URL             base URL of the bot
//   MILLORBOT_SHARED_SECRET   HMAC secret (hex)
//   OUTBOX_POLL_INTERVAL_MS   default 5000
//   OUTBOX_MAX_ATTEMPTS       default 10

import crypto from "node:crypto"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const POLL_INTERVAL = Number(process.env.OUTBOX_POLL_INTERVAL_MS || 5000)
const MAX_ATTEMPTS = Number(process.env.OUTBOX_MAX_ATTEMPTS || 10)
const BATCH = 20
const REQUEST_TIMEOUT_MS = 10_000

function log(level, message, extra) {
  const line = { ts: new Date().toISOString(), level, message, ...(extra || {}) }
  console.log(JSON.stringify(line))
}

function topicToPath(topic) {
  if (topic === "order.paid") return "/api/orders/paid"
  if (topic === "order.status.changed") return "/api/orders/status"
  if (topic === "product.stock.depleted") return "/api/products/stock/depleted"
  if (topic === "product.stock.low") return "/api/products/stock/low"
  return `/api/${String(topic).replace(/\./g, "/")}`
}

function signPayload(rawBody, secret) {
  const ts = Math.floor(Date.now() / 1000)
  const hex = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex")
  return {
    "X-Millorbot-Timestamp": String(ts),
    "X-Millorbot-Signature": `sha256=${hex}`,
  }
}

function backoffSeconds(attempts) {
  const s = Math.min(5 * Math.pow(5, attempts), 86400)
  return Math.floor(s)
}

async function deliverEvent(event) {
  const url = `${process.env.MILLORBOT_URL.replace(/\/$/, "")}${topicToPath(event.topic)}`
  const rawBody = JSON.stringify(event.payload)
  const headers = signPayload(rawBody, process.env.MILLORBOT_SHARED_SECRET)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const started = Date.now()

  let res, responseBody, error
  let statusCode = 0

  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: rawBody,
      signal: controller.signal,
    })
    statusCode = res.status
    const text = await res.text()
    try {
      responseBody = text ? JSON.parse(text) : null
    } catch {
      responseBody = text
    }
  } catch (e) {
    error = e.name === "AbortError" ? "timeout" : e.message || "network_error"
  } finally {
    clearTimeout(timeout)
  }

  const durationMs = Date.now() - started
  const ok = !error && res && res.ok

  // Write IntegrationLog (best-effort, don't fail the delivery path)
  try {
    await prisma.integrationLog.create({
      data: {
        direction: "outbound",
        source: "millorbot",
        event: event.topic,
        eventId: event.eventId,
        statusCode: statusCode || null,
        request: { url, payload: event.payload },
        response: responseBody ?? null,
        error: error ?? (!ok ? `http_${statusCode}` : null),
        durationMs,
      },
    })
  } catch (e) {
    log("error", "integration_log_failed", { err: e.message })
  }

  if (ok) {
    await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: "delivered",
        lastStatusCode: statusCode,
        lastError: null,
        deliveredAt: new Date(),
      },
    })
    log("info", "delivered", { eventId: event.eventId, topic: event.topic, durationMs })
    return
  }

  const newAttempts = event.attempts + 1
  // 4xx (except 408, 429) = permanent failure — dead letter immediately
  const isPermanent =
    statusCode >= 400 && statusCode < 500 && statusCode !== 408 && statusCode !== 429
  const isDead = isPermanent || newAttempts >= MAX_ATTEMPTS

  await prisma.outboxEvent.update({
    where: { id: event.id },
    data: {
      status: isDead ? "dead" : "pending",
      attempts: newAttempts,
      lastStatusCode: statusCode || null,
      lastError: (error || `http_${statusCode}`).slice(0, 2000),
      nextAttemptAt: isDead ? event.nextAttemptAt : new Date(Date.now() + backoffSeconds(newAttempts) * 1000),
    },
  })

  log(isDead ? "error" : "warn", isDead ? "dead_letter" : "retry_scheduled", {
    eventId: event.eventId,
    topic: event.topic,
    attempts: newAttempts,
    statusCode,
    error: error ?? null,
  })
}

async function tick() {
  const enabled = process.env.MILLORBOT_ENABLED === "true"
  if (!enabled || !process.env.MILLORBOT_URL || !process.env.MILLORBOT_SHARED_SECRET) {
    return
  }

  const ready = await prisma.outboxEvent.findMany({
    where: { status: "pending", nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: BATCH,
  })

  if (ready.length === 0) return

  for (const event of ready) {
    try {
      await deliverEvent(event)
    } catch (e) {
      log("error", "deliver_threw", { eventId: event.eventId, err: e.message })
    }
  }
}

let running = true
async function loop() {
  while (running) {
    try {
      await tick()
    } catch (e) {
      log("error", "tick_failed", { err: e.message })
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL))
  }
}

function shutdown(sig) {
  return async () => {
    log("info", "shutdown", { signal: sig })
    running = false
    await prisma.$disconnect().catch(() => {})
    process.exit(0)
  }
}

process.on("SIGTERM", shutdown("SIGTERM"))
process.on("SIGINT", shutdown("SIGINT"))

log("info", "outbox_worker_started", {
  enabled: process.env.MILLORBOT_ENABLED === "true",
  hasUrl: !!process.env.MILLORBOT_URL,
  pollIntervalMs: POLL_INTERVAL,
  maxAttempts: MAX_ATTEMPTS,
})

loop()
