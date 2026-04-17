import crypto from "crypto"

const MAX_TIMESTAMP_SKEW_SECONDS = 300 // 5 minutes

export interface SignedHeaders {
  "X-Millorbot-Timestamp": string
  "X-Millorbot-Signature": string
}

export function signPayload(rawBody: string, secret: string, timestamp?: number): SignedHeaders {
  const ts = timestamp ?? Math.floor(Date.now() / 1000)
  const hex = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex")
  return {
    "X-Millorbot-Timestamp": String(ts),
    "X-Millorbot-Signature": `sha256=${hex}`,
  }
}

export interface VerifyResult {
  ok: boolean
  reason?: "missing_headers" | "stale_timestamp" | "bad_signature" | "bad_format"
}

export function verifySignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
  secret: string,
  now: number = Math.floor(Date.now() / 1000),
): VerifyResult {
  if (!timestampHeader || !signatureHeader) {
    return { ok: false, reason: "missing_headers" }
  }

  const ts = Number(timestampHeader)
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "bad_format" }
  }

  if (Math.abs(now - ts) > MAX_TIMESTAMP_SKEW_SECONDS) {
    return { ok: false, reason: "stale_timestamp" }
  }

  const prefix = "sha256="
  if (!signatureHeader.startsWith(prefix)) {
    return { ok: false, reason: "bad_format" }
  }
  const provided = signatureHeader.slice(prefix.length)

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${ts}.${rawBody}`)
    .digest("hex")

  const a = Buffer.from(provided, "hex")
  const b = Buffer.from(expected, "hex")
  if (a.length !== b.length) return { ok: false, reason: "bad_signature" }
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" }

  return { ok: true }
}
