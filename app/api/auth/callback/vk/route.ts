import { cookies, headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"
import { encode } from "@auth/core/jwt"
import { prisma } from "@/lib/prisma"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

// VK ID callback — overrides NextAuth catch-all for /api/auth/callback/vk.
// Performs token exchange (with device_id which @auth/core can't pass), creates/links user,
// and issues a NextAuth-compatible session cookie so the rest of the app works unchanged.
export async function GET(request: NextRequest) {
  // Build public origin up-front so the catch-all error handler can redirect too
  const headersList = await headers()
  const forwardedHost = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "millor-coffee.ru"
  const proto = headersList.get("x-forwarded-proto") ?? "https"
  const origin = `${proto}://${forwardedHost}`

  try {
    return await handleCallback(request, origin, proto)
  } catch (e) {
    // PS7: санитизация — в error-объекте могут быть fetch.url с токенами,
    // prisma-query-детали, cause-chain. Логируем только безопасное подмножество.
    const err = e as { name?: string; code?: string; message?: string }
    console.error("VK callback fatal error:", {
      name: err?.name,
      code: err?.code,
      message: err?.message?.slice(0, 500),
    })
    return NextResponse.redirect(`${origin}/auth/login?error=vk_unexpected`)
  }
}

async function handleCallback(request: NextRequest, origin: string, proto: string) {
  // Rate-limit по IP, чтобы атакующий не мог перебирать state/code-комбинации.
  // Порог щедрее чем для login (20/5min) — у одного юзера может быть несколько
  // попыток при сетевых сбоях, а легитимный трафик через VK невелик.
  const h = await headers()
  const clientIp =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  const rl = checkRateLimit(`vk-callback:${clientIp}`, RATE_LIMITS.oauthCallback)
  if (!rl.allowed) {
    console.warn(`[vk-callback] rate-limited IP ${clientIp}`)
    return NextResponse.redirect(`${origin}/auth/login?error=vk_rate_limited`)
  }

  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get("code")
  const deviceId = searchParams.get("device_id")
  const state = searchParams.get("state")

  const cookieStore = await cookies()
  const codeVerifier = cookieStore.get("vk_code_verifier")?.value
  const expectedState = cookieStore.get("vk_state")?.value

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
    // Не логируем сам tokens-объект — он может содержать access_token/id_token/
    // refresh_token даже при частичном fail'e. Утекут в журналы Beget'а.
    console.error("VK token exchange failed:", {
      error: tokens.error,
      errorDescription: tokens.error_description,
      hasIdToken: Boolean(tokens.id_token),
      hasRefreshToken: Boolean(tokens.refresh_token),
    })
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

  // Also call VK ID user_info endpoint as a second source (sometimes id_token is minimal)
  try {
    const uiRes = await fetch("https://id.vk.ru/oauth2/user_info", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        access_token: tokens.access_token,
      }).toString(),
    })
    const uiData = await uiRes.json()
    const u = uiData.user ?? {}
    if (u.first_name && !userInfo.first_name) userInfo.first_name = u.first_name
    if (u.last_name && !userInfo.last_name) userInfo.last_name = u.last_name
    if (u.email && !userInfo.email) userInfo.email = u.email
    if (u.phone && !userInfo.phone) userInfo.phone = u.phone
    if (u.avatar && !userInfo.avatar) userInfo.avatar = u.avatar
  } catch {
    // Non-fatal
  }

  // Enrich with photo from legacy VK API as final fallback for photo_200
  try {
    const apiRes = await fetch(
      `https://api.vk.com/method/users.get?fields=photo_200&access_token=${encodeURIComponent(tokens.access_token)}&v=5.199`
    )
    const apiData = await apiRes.json()
    const apiUser = apiData.response?.[0]
    if (apiUser?.photo_200 && !userInfo.avatar) userInfo.avatar = apiUser.photo_200
  } catch {
    // Non-fatal; continue without photo
  }

  console.log("VK callback userInfo:", {
    sub: userInfo.sub,
    hasFirstName: Boolean(userInfo.first_name),
    hasLastName: Boolean(userInfo.last_name),
    hasEmail: Boolean(userInfo.email),
    hasPhone: Boolean(userInfo.phone),
    hasAvatar: Boolean(userInfo.avatar),
  })

  const vkUserId = String(userInfo.sub ?? tokens.user_id ?? "")
  if (!vkUserId) return fail("no_user_id")

  // Поиск существующего пользователя только по связке provider+providerAccountId.
  // Раньше при отсутствии связки fallback шёл по email → silent account linking:
  // атакующий, зарегистрировавший VK на чужой email, получал доступ к заказам
  // владельца этого email без его согласия. Теперь линковка возможна только
  // через explicit UI (/account/connections) из-под уже авторизованного пользователя.
  const emailLower = userInfo.email?.toLowerCase()
  const existingAccount = await prisma.account.findFirst({
    where: { provider: "vk", providerAccountId: vkUserId },
    include: { user: true },
  })

  let user = existingAccount?.user ?? null

  // Если VK-аккаунт не привязан, проверяем занят ли email.
  // Если занят — блокируем логин, предлагаем войти паролем и привязать VK вручную.
  if (!user && emailLower) {
    const emailOwner = await prisma.user.findUnique({
      where: { email: emailLower },
      select: { id: true },
    })
    if (emailOwner) {
      return fail("email_already_registered")
    }
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
  } else {
    // user здесь всегда соответствует existingAccount (линковка по email отключена —
    // см. проверку email_already_registered выше), поэтому отдельно создавать
    // Account не нужно. Обновляем только токены на existingAccount — они могут
    // refreshнуться при повторном входе.
    if (existingAccount) {
      await prisma.account.update({
        where: { id: existingAccount.id },
        data: {
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token ?? null,
          expires_at: tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : null,
          token_type: tokens.token_type ?? null,
          scope: tokens.scope ?? null,
          id_token: tokens.id_token ?? null,
        },
      })
    }
    // Backfill: always try to fill in missing profile fields from VK on every sign-in
    const updates: Record<string, string | Date> = {}
    if (!user.name && fullName) updates.name = fullName
    if (!user.phone && phoneFromVk) updates.phone = phoneFromVk
    if (!user.avatarUrl && userInfo.avatar) updates.avatarUrl = userInfo.avatar
    if (!user.image && userInfo.avatar) updates.image = userInfo.avatar
    if (!user.email && emailLower) {
      // Guard against unique email collision — another user may own this email already
      const conflict = await prisma.user.findUnique({ where: { email: emailLower }, select: { id: true } })
      if (!conflict || conflict.id === user.id) {
        updates.email = emailLower
        updates.emailVerified = new Date()
      }
    }
    if (Object.keys(updates).length > 0) {
      try {
        user = await prisma.user.update({ where: { id: user.id }, data: updates })
      } catch (e) {
        console.error("VK backfill update failed:", e)
        // Non-fatal — continue with the current user data
      }
    }
  }

  // Issue NextAuth-compatible session JWT — cookie name + salt depend on HTTPS.
  // maxAge синхронизирован с session.maxAge в lib/auth.ts (7 дней, P1-5).
  const useSecure = proto === "https"
  const cookieName = useSecure ? "__Secure-authjs.session-token" : "authjs.session-token"
  const maxAge = 7 * 24 * 60 * 60

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
