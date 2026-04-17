import { signPayload } from "@/lib/integrations/hmac"
import type { MillorbotOutboxPayload } from "./types"

export interface MillorbotSendResult {
  ok: boolean
  statusCode: number
  body: unknown
  durationMs: number
  error?: string
  skipped?: boolean
}

const REQUEST_TIMEOUT_MS = 10_000

function topicToPath(topic: string): string {
  // "order.paid" -> "/api/orders/paid"
  if (topic === "order.paid") return "/api/orders/paid"
  if (topic === "order.status.changed") return "/api/orders/status"
  // Fallback: dot-to-slash mapping, prefixed with /api/
  return `/api/${topic.replace(/\./g, "/")}`
}

export async function sendToMillorbot(
  topic: string,
  payload: MillorbotOutboxPayload,
): Promise<MillorbotSendResult> {
  const enabled = process.env.MILLORBOT_ENABLED === "true"
  const baseUrl = process.env.MILLORBOT_URL
  const secret = process.env.MILLORBOT_SHARED_SECRET

  if (!enabled || !baseUrl || !secret) {
    return {
      ok: false,
      statusCode: 0,
      body: null,
      durationMs: 0,
      skipped: true,
      error: !enabled
        ? "millorbot_disabled"
        : !baseUrl
        ? "millorbot_url_missing"
        : "millorbot_secret_missing",
    }
  }

  const rawBody = JSON.stringify(payload)
  const headers = signPayload(rawBody, secret)
  const url = `${baseUrl.replace(/\/$/, "")}${topicToPath(topic)}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const started = Date.now()

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: rawBody,
      signal: controller.signal,
    })

    const text = await res.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      // keep as text
    }

    return {
      ok: res.ok,
      statusCode: res.status,
      body,
      durationMs: Date.now() - started,
    }
  } catch (e) {
    const err = e as Error
    return {
      ok: false,
      statusCode: 0,
      body: null,
      durationMs: Date.now() - started,
      error: err.name === "AbortError" ? "timeout" : err.message || "network_error",
    }
  } finally {
    clearTimeout(timeout)
  }
}
