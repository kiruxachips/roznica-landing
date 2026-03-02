"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Package, FolderTree, ShoppingCart, MessageSquare, LayoutDashboard, LogOut, Sparkles, Ticket, BookOpen } from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"

const navItems = [
  { name: "Дашборд", href: "/admin", icon: LayoutDashboard },
  { name: "Товары", href: "/admin/products", icon: Package },
  { name: "Категории", href: "/admin/categories", icon: FolderTree },
  { name: "Заказы", href: "/admin/orders", icon: ShoppingCart },
  { name: "Отзывы", href: "/admin/reviews", icon: MessageSquare },
  { name: "Акции", href: "/admin/promotions", icon: Sparkles },
  { name: "Промокоды", href: "/admin/promo-codes", icon: Ticket },
  { name: "Статьи", href: "/admin/blog", icon: BookOpen },
  { name: "Рубрики блога", href: "/admin/blog/categories", icon: FolderTree },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-white border-r border-border min-h-screen flex flex-col">
      <div className="p-6 border-b border-border">
        <Link href="/admin" className="text-lg font-serif font-bold text-primary">
          Millor Admin
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
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

      <div className="p-4 border-t border-border">
        <Link
          href="/"
          target="_blank"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors mb-1"
        >
          Открыть сайт
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/admin/login" })}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Выйти
        </button>
      </div>
    </aside>
  )
}
