"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Home, Search, ShoppingBag, User } from "lucide-react"
import { useCartStore } from "@/lib/store/cart"

interface NavItem {
  label: string
  href: string
  icon: typeof Home
  match: (p: string) => boolean
  showBadge?: boolean
}

const items: NavItem[] = [
  { label: "Главная", href: "/", icon: Home, match: (p) => p === "/" },
  {
    label: "Каталог",
    href: "/catalog",
    icon: Search,
    match: (p) => p.startsWith("/catalog"),
  },
  {
    label: "Корзина",
    href: "/cart",
    icon: ShoppingBag,
    match: (p) => p.startsWith("/cart"),
    showBadge: true,
  },
  {
    label: "Аккаунт",
    href: "/account",
    icon: User,
    match: (p) => p.startsWith("/account") || p.startsWith("/auth"),
  },
]

/**
 * Фиксированная нижняя навигация для mobile. Не рендерится на админских
 * роутах (где свой layout) и на checkout (sticky CTA там важнее).
 */
export function BottomNav() {
  const pathname = usePathname()
  // Mount-guard: Zustand persist rehydrates из localStorage на client only.
  // Без этого badge сначала отрисуется как 0 (server) → потом прыгнет (client)
  // → hydration mismatch warning + flash в UI.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const cartCount = useCartStore((s) =>
    s.items.reduce((sum, i) => sum + i.quantity, 0)
  )

  // На checkout/admin/wholesale/auth — прячем (чтобы юзер случайно не
  // потерял введённые данные при регистрации/логине). На карточке товара
  // /catalog/[slug] sticky-CTA «В корзину» (z-50) перекрывает BottomNav, а
  // глобальная навигация на детальной странице мешает выбору варианта —
  // прячем тоже. На листинге /catalog оставляем как обычно.
  const isProductDetail =
    pathname.startsWith("/catalog/") && pathname !== "/catalog"
  const hide =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/checkout") ||
    pathname.startsWith("/wholesale") ||
    pathname.startsWith("/auth") ||
    isProductDetail
  if (hide) return null

  return (
    <nav
      aria-label="Нижняя навигация"
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-border shadow-[0_-4px_12px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active = item.match(pathname)
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center py-2 text-[11px] transition-colors ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 mb-0.5" />
                  {item.showBadge && mounted && cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-primary text-primary-foreground rounded-full text-[10px] font-semibold flex items-center justify-center">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
