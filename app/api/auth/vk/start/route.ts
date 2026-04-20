import crypto from "crypto"
import { cookies, headers } from "next/headers"
import { NextResponse } from "next/server"

// VK ID (id.vk.ru) OAuth 2.1 entrypoint — requires PKCE, device_id, custom token exchange.
// Flow: generate PKCE + state, stash in HTTP-only cookies, redirect to id.vk.ru/authorize.
// Callback handled by /api/auth/callback/vk (our custom handler, overrides NextAuth catch-all).
export async function GET() {
  const clientId = process.env.VK_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: "VK not configured" }, { status: 503 })
  }

  const codeVerifier = crypto.randomBytes(32).toString("base64url")
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url")
  const state = crypto.randomBytes(16).toString("base64url")

  const headersList = await headers()
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "millor-coffee.ru"
  const proto = headersList.get("x-forwarded-proto") ?? "https"
  const redirectUri = `${proto}://${host}/api/auth/callback/vk`

  const cookieStore = await cookies()
  const cookieOpts = { httpOnly: true, secure: proto === "https", sameSite: "lax" as const, path: "/", maxAge: 600 }
  cookieStore.set("vk_code_verifier", codeVerifier, cookieOpts)
  cookieStore.set("vk_state", state, cookieOpts)

  const url = new URL("https://id.vk.ru/authorize")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", "vkid.personal_info email")
  url.searchParams.set("state", state)
  url.searchParams.set("code_challenge", codeChallenge)
  url.searchParams.set("code_challenge_method", "S256")

  return NextResponse.redirect(url.toString())
}
