"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { User, ShoppingBag, Heart, MapPin, Bell, LogOut, Gift, Repeat } from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"

const navItems = [
  { name: "Профиль", href: "/account/profile", icon: User },
  { name: "Мои заказы", href: "/account/orders", icon: ShoppingBag },
  { name: "Подписки", href: "/account/subscriptions", icon: Repeat },
  { name: "Избранное", href: "/account/favorites", icon: Heart },
  { name: "Адреса", href: "/account/addresses", icon: MapPin },
  { name: "Пригласить друга", href: "/account/referrals", icon: Gift },
  { name: "Уведомления", href: "/account/notifications", icon: Bell },
]

export function AccountSidebar() {
  const pathname = usePathname()
  const mobileScrollRef = useRef<HTMLDivElement>(null)
  const activeMobileRef = useRef<HTMLAnchorElement>(null)

  // Автоскролл к активному пункту в мобильном tab-bar — иначе при заходе на
  // /account/notifications юзер видит «Профиль / Заказы», и не понимает, где
  // он сейчас.
  useEffect(() => {
    const container = mobileScrollRef.current
    const active = activeMobileRef.current
    if (!container || !active) return
    const cRect = container.getBoundingClientRect()
    const aRect = active.getBoundingClientRect()
    if (aRect.left < cRect.left || aRect.right > cRect.right) {
      const offset =
        active.offsetLeft - container.offsetLeft - (container.clientWidth - active.clientWidth) / 2
      container.scrollTo({ left: Math.max(0, offset), behavior: "smooth" })
    }
  }, [pathname])

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="bg-white rounded-2xl shadow-sm p-4 sticky top-24">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              )
            })}
          </nav>

          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors w-full"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile tabs */}
      <div className="lg:hidden -mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          ref={mobileScrollRef}
          className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x"
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                ref={isActive ? activeMobileRef : undefined}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors snap-start min-h-[40px]",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-white text-muted-foreground hover:bg-muted"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.name}
              </Link>
            )
          })}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm text-muted-foreground bg-white hover:bg-muted whitespace-nowrap transition-colors snap-start min-h-[40px]"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Выйти
          </button>
        </div>
      </div>
    </>
  )
}
