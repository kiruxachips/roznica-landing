import { randomBytes } from "crypto"

/**
 * Криптостойкий токен для one-time URL'ов (account deletion confirm,
 * email verification, password reset, tracking-links для гостей и т.п.).
 *
 * Используем base64url — без "+/=", безопасен в URL без encoding.
 */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url")
}
