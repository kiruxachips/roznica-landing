"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Package, ShoppingBag, Building2, FileText, LogOut, Users } from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"

const navItems = [
  { name: "Дашборд", href: "/wholesale", icon: LayoutDashboard, exact: true },
  { name: "Каталог", href: "/wholesale/catalog", icon: Package },
  { name: "Корзина", href: "/wholesale/cart", icon: ShoppingBag },
  { name: "Мои заявки", href: "/wholesale/orders", icon: FileText },
  { name: "Компания", href: "/wholesale/company", icon: Building2, exact: true },
  { name: "Сотрудники", href: "/wholesale/company/users", icon: Users },
]

export function WholesaleSidebar() {
  const pathname = usePathname()
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="bg-white rounded-2xl shadow-sm p-4 sticky top-24">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  isActive(item.href, item.exact)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            ))}
          </nav>
          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={() => signOut({ callbackUrl: "/wholesale/login" })}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors w-full"
            >
              <LogOut className="w-4 h-4" />
              Выйти
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:hidden -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors snap-start",
                isActive(item.href, item.exact)
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-muted-foreground hover:bg-muted"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.name}
            </Link>
          ))}
          <button
            onClick={() => signOut({ callbackUrl: "/wholesale/login" })}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm text-muted-foreground bg-white hover:bg-muted whitespace-nowrap"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Выйти
          </button>
        </div>
      </div>
    </>
  )
}
