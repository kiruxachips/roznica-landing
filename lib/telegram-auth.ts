import crypto from "crypto"

interface TelegramAuthData {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export function verifyTelegramAuth(data: TelegramAuthData): boolean {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return false

  const { hash, ...rest } = data

  // Check auth_date is not older than 24 hours
  const now = Math.floor(Date.now() / 1000)
  if (now - data.auth_date > 86400) return false

  // Build check string
  const checkString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key as keyof typeof rest]}`)
    .join("\n")

  // HMAC-SHA256 verification
  const secretKey = crypto.createHash("sha256").update(botToken).digest()
  const hmac = crypto.createHmac("sha256", secretKey).update(checkString).digest("hex")

  return hmac === hash
}

export function getTelegramDisplayName(data: TelegramAuthData): string {
  const parts = [data.first_name, data.last_name].filter(Boolean)
  return parts.join(" ") || data.username || `Telegram ${data.id}`
}
