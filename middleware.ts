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

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth
  const user = req.auth?.user as Record<string, unknown> | undefined
  const userType = user?.userType as string | undefined
  const role = user?.role as string | undefined

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

  return NextResponse.next()
})

export const config = {
  matcher: ["/admin/:path*", "/account/:path*", "/auth/:path*"],
}
