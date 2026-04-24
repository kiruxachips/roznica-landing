import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

/**
 * Маршруты, доступные только роли "admin" (менеджеру — 403 с редиректом на дашборд).
 * Менеджер может заходить на остальные /admin/* — проверки на уровне actions по permission.
 */
const ADMIN_ONLY_PREFIXES = [
  "/admin/delivery",
  "/admin/integrations",
  "/admin/users",
  "/admin/activity",
]

/**
 * Публичные страницы оптового кабинета — доступны без логина.
 * login + register + success + password reset.
 */
const WHOLESALE_PUBLIC_PATHS = new Set([
  "/wholesale/login",
  "/wholesale/register",
  "/wholesale/register/success",
  "/wholesale/password/reset",
  "/wholesale/password/reset/confirm",
  "/wholesale/suspended",
])

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth
  const user = req.auth?.user as Record<string, unknown> | undefined
  const userType = user?.userType as string | undefined
  const role = user?.role as string | undefined
  const companyStatus = user?.companyStatus as string | undefined

  // G2: referral-code tracking. Если в URL ?ref=CODE — кладём cookie на
  // 30 дней и продолжаем. Cookie читается в createOrder (server-action)
  // чтобы применить reward новому юзеру на первой покупке.
  const refParam = req.nextUrl.searchParams.get("ref")
  if (refParam && refParam.length > 2 && refParam.length < 30) {
    const response = NextResponse.next()
    response.cookies.set("ref", refParam.toUpperCase(), {
      maxAge: 30 * 24 * 60 * 60,
      httpOnly: false, // читается из server-actions через cookies(), httpOnly не критичен
      sameSite: "lax",
      path: "/",
    })
    // Не редиректим — пусть юзер видит нужную страницу с query-param
    // (наложение на контент не нужно, cookie уже стоит).
    return response
  }

  // Admin routes
  if (pathname.startsWith("/admin")) {
    const isLoginPage = pathname === "/admin/login"
    const isRegisterPage = pathname === "/admin/register"

    // Публичные страницы (логин + регистрация менеджера) — пускаем.
    // Уже-авторизованный админ, попав на эти страницы, редиректится в дашборд.
    if (isLoginPage || isRegisterPage) {
      if (isAuthenticated && userType === "admin") {
        return NextResponse.redirect(new URL("/admin", req.url))
      }
      return NextResponse.next()
    }

    if (!isAuthenticated || userType !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", req.url))
    }

    // Запрет менеджеру на критичные разделы.
    if (role !== "admin") {
      const blocked = ADMIN_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
      if (blocked) {
        const url = new URL("/admin", req.url)
        url.searchParams.set("denied", "1")
        return NextResponse.redirect(url)
      }
    }
  }

  // Account routes — require customer auth
  if (pathname.startsWith("/account")) {
    if (!isAuthenticated || userType !== "customer") {
      const loginUrl = new URL("/auth/login", req.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Auth routes — redirect if already logged in as customer
  if (pathname.startsWith("/auth")) {
    if (isAuthenticated && userType === "customer") {
      return NextResponse.redirect(new URL("/account", req.url))
    }
  }

  // Wholesale routes
  if (pathname.startsWith("/wholesale")) {
    // /wholesale/invite/{token} — публичная страница активации приглашения
    const isInvitePath = pathname.startsWith("/wholesale/invite/")
    const isPublic = isInvitePath || WHOLESALE_PUBLIC_PATHS.has(pathname)

    // Публичные: если уже залогинен как wholesale — отправляем в кабинет
    if (isPublic) {
      if (isAuthenticated && userType === "wholesale") {
        // Исключение — /wholesale/suspended показываем залогиненному с suspended-статусом
        if (pathname === "/wholesale/suspended" && companyStatus === "suspended") {
          return NextResponse.next()
        }
        return NextResponse.redirect(new URL("/wholesale", req.url))
      }
      return NextResponse.next()
    }

    // Приватные: требуют wholesale-сессии
    if (!isAuthenticated || userType !== "wholesale") {
      const loginUrl = new URL("/wholesale/login", req.url)
      loginUrl.searchParams.set("callbackUrl", pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Если компания приостановлена — только страница /wholesale/suspended
    if (companyStatus === "suspended" && pathname !== "/wholesale/suspended") {
      return NextResponse.redirect(new URL("/wholesale/suspended", req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/auth/:path*", "/wholesale/:path*"],
}
