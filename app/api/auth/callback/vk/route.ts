import { cookies, headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { encode } from "@auth/core/jwt"
import { prisma } from "@/lib/prisma"

// VK ID callback — overrides NextAuth catch-all for /api/auth/callback/vk.
// Performs token exchange (with device_id which @auth/core can't pass), creates/links user,
// and issues a NextAuth-compatible session cookie so the rest of the app works unchanged.
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const deviceId = searchParams.get("device_id")
  const state = searchParams.get("state")

  const cookieStore = await cookies()
  const codeVerifier = cookieStore.get("vk_code_verifier")?.value
  const expectedState = cookieStore.get("vk_state")?.value

  // Build public origin from forwarded headers — `request.url` inside Docker resolves to 0.0.0.0:3000
  const headersList = await headers()
  const forwardedHost = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "millor-coffee.ru"
  const proto = headersList.get("x-forwarded-proto") ?? "https"
  const origin = `${proto}://${forwardedHost}`

  function fail(reason: string) {
    console.error("VK callback error:", reason)
    return NextResponse.redirect(`${origin}/auth/login?error=vk_${reason}`)
  }

  if (!code || !deviceId || !state) return fail("missing_params")
  if (!codeVerifier || !expectedState) return fail("missing_cookies")
  if (state !== expectedState) return fail("state_mismatch")

  const redirectUri = `${origin}/api/auth/callback/vk`

  const clientId = process.env.VK_CLIENT_ID!
  const clientSecret = process.env.VK_CLIENT_SECRET!

  // Exchange code (+ device_id which is VK-specific) for access_token + id_token
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    device_id: deviceId,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  })

  let tokens: {
    access_token?: string
    id_token?: string
    refresh_token?: string
    expires_in?: number
    token_type?: string
    scope?: string
    user_id?: number | string
    error?: string
    error_description?: string
  }
  try {
    const tokenRes = await fetch("https://id.vk.ru/oauth2/auth", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    })
    tokens = await tokenRes.json()
  } catch (e) {
    console.error("VK token fetch failed:", e)
    return fail("token_fetch")
  }

  if (!tokens.access_token) {
    console.error("VK token exchange failed:", tokens)
    return fail("token_exchange")
  }

  // Decode id_token JWT — VK ID embeds user info (incl. email) here
  let userInfo: {
    sub?: string
    first_name?: string
    last_name?: string
    email?: string
    avatar?: string
    phone?: string
  } = {}
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8")
      )
      userInfo = payload
    } catch (e) {
      console.error("VK id_token decode failed:", e)
    }
  }

  // Enrich with photo from legacy VK API
  try {
    const apiRes = await fetch(
      `https://api.vk.com/method/users.get?fields=photo_200&access_token=${encodeURIComponent(tokens.access_token)}&v=5.199`
    )
    const apiData = await apiRes.json()
    const apiUser = apiData.response?.[0]
    if (apiUser?.photo_200) userInfo.avatar = apiUser.photo_200
  } catch {
    // Non-fatal; continue without photo
  }

  const vkUserId = String(userInfo.sub ?? tokens.user_id ?? "")
  if (!vkUserId) return fail("no_user_id")

  // Find existing user by VK account link OR by email match
  const emailLower = userInfo.email?.toLowerCase()
  const existingAccount = await prisma.account.findFirst({
    where: { provider: "vk", providerAccountId: vkUserId },
    include: { user: true },
  })

  let user = existingAccount?.user ?? null
  if (!user && emailLower) {
    user = await prisma.user.findUnique({ where: { email: emailLower } })
  }

  const fullName = [userInfo.first_name, userInfo.last_name].filter(Boolean).join(" ").trim() || null
  // VK ID may return phone as "+7XXXXXXXXXX" — normalize minimal (strip spaces)
  const phoneFromVk = userInfo.phone ? userInfo.phone.replace(/\s/g, "") : null

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: emailLower ?? null,
        emailVerified: emailLower ? new Date() : null,
        name: fullName,
        phone: phoneFromVk,
        avatarUrl: userInfo.avatar ?? null,
        image: userInfo.avatar ?? null,
        accounts: {
          create: {
            provider: "vk",
            providerAccountId: vkUserId,
            type: "oauth",
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token ?? null,
            expires_at: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null,
            token_type: tokens.token_type ?? null,
            scope: tokens.scope ?? null,
            id_token: tokens.id_token ?? null,
          },
        },
      },
    })
  } else if (!existingAccount) {
    // Link VK account to existing user (matched by email)
    await prisma.account.create({
      data: {
        userId: user.id,
        provider: "vk",
        providerAccountId: vkUserId,
        type: "oauth",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null,
        token_type: tokens.token_type ?? null,
        scope: tokens.scope ?? null,
        id_token: tokens.id_token ?? null,
      },
    })
    // Backfill missing fields from VK data (don't overwrite user-provided values)
    const updates: Record<string, string | Date> = {}
    if (!user.name && fullName) updates.name = fullName
    if (!user.phone && phoneFromVk) updates.phone = phoneFromVk
    if (!user.avatarUrl && userInfo.avatar) updates.avatarUrl = userInfo.avatar
    if (!user.image && userInfo.avatar) updates.image = userInfo.avatar
    if (!user.email && emailLower) {
      updates.email = emailLower
      updates.emailVerified = new Date()
    }
    if (Object.keys(updates).length > 0) {
      user = await prisma.user.update({ where: { id: user.id }, data: updates })
    }
  }

  // Issue NextAuth-compatible session JWT — cookie name + salt depend on HTTPS
  const useSecure = proto === "https"
  const cookieName = useSecure ? "__Secure-authjs.session-token" : "authjs.session-token"
  const maxAge = 30 * 24 * 60 * 60

  const sessionToken = await encode({
    token: {
      sub: user.id,
      name: user.name,
      email: user.email,
      picture: user.avatarUrl ?? undefined,
      userType: "customer",
    },
    secret: process.env.NEXTAUTH_SECRET!,
    salt: cookieName,
    maxAge,
  })

  const response = NextResponse.redirect(`${origin}/account`)
  response.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: useSecure,
    sameSite: "lax",
    path: "/",
    maxAge,
  })
  // Clean up one-time-use PKCE cookies
  response.cookies.delete("vk_code_verifier")
  response.cookies.delete("vk_state")

  return response
}
