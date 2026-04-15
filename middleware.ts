import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isAuthenticated = !!req.auth
  const userType = (req.auth?.user as Record<string, unknown>)?.userType as string | undefined

  // Admin routes
  if (pathname.startsWith("/admin")) {
    const isLoginPage = pathname === "/admin/login"

    // Logged-in admin on login page → redirect to dashboard.
    // Anonymous on login page → let the page render (no auth() overhead beyond what's already done).
    if (isLoginPage) {
      if (isAuthenticated && userType === "admin") {
        return NextResponse.redirect(new URL("/admin", req.url))
      }
      return NextResponse.next()
    }

    if (!isAuthenticated || userType !== "admin") {
      return NextResponse.redirect(new URL("/admin/login", req.url))
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
