"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Package,
  FolderTree,
  ShoppingCart,
  MessageSquare,
  LayoutDashboard,
  LogOut,
  Sparkles,
  Ticket,
  BookOpen,
  Truck,
  Webhook,
  Boxes,
  Users,
  Activity,
  Mail,
  Gift,
  Building2,
  FileText,
  Wallet,
  UserCheck,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { can, type AdminRole, type Permission } from "@/lib/permissions"

interface NavItem {
  name: string
  href: string
  icon: typeof LayoutDashboard
  permission: Permission | null
}

const ALL_NAV_ITEMS: NavItem[] = [
  { name: "Дашборд", href: "/admin", icon: LayoutDashboard, permission: null },
  { name: "Товары", href: "/admin/products", icon: Package, permission: "products.view" },
  { name: "Склад", href: "/admin/warehouse", icon: Boxes, permission: "stock.view" },
  { name: "Категории", href: "/admin/categories", icon: FolderTree, permission: "categories.view" },
  { name: "Заказы", href: "/admin/orders", icon: ShoppingCart, permission: "orders.view" },
  { name: "Клиенты", href: "/admin/customers", icon: Users, permission: "customers.view" },
  { name: "Доставка", href: "/admin/delivery", icon: Truck, permission: "delivery.settings" },
  { name: "Отзывы", href: "/admin/reviews", icon: MessageSquare, permission: "reviews.view" },
  { name: "Акции", href: "/admin/promotions", icon: Sparkles, permission: "promos.view" },
  { name: "Промокоды", href: "/admin/promo-codes", icon: Ticket, permission: "promos.view" },
  { name: "Подарки", href: "/admin/gifts", icon: Gift, permission: "gifts.view" },
  { name: "Статьи", href: "/admin/blog", icon: BookOpen, permission: "blog.view" },
  { name: "Рубрики блога", href: "/admin/blog/categories", icon: FolderTree, permission: "blog.edit" },
  { name: "Интеграции", href: "/admin/integrations", icon: Webhook, permission: "integrations.view" },
  { name: "Рассылка писем", href: "/admin/email-dispatch", icon: Mail, permission: "email.view" },
  { name: "Пользователи", href: "/admin/users", icon: Users, permission: "users.view" },
  { name: "Журнал действий", href: "/admin/activity", icon: Activity, permission: "users.view" },
  // Wholesale (B2B) — группа разделов для работы с оптовыми клиентами
  { name: "Опт: Заявки", href: "/admin/wholesale/requests", icon: UserCheck, permission: "wholesale.requests.view" },
  { name: "Опт: Компании", href: "/admin/wholesale/companies", icon: Building2, permission: "wholesale.companies.view" },
  { name: "Опт: Прайс-листы", href: "/admin/wholesale/price-lists", icon: FileText, permission: "wholesale.priceLists.view" },
  { name: "Опт: Заказы", href: "/admin/wholesale/orders", icon: ShoppingCart, permission: "wholesale.orders.view" },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = ((session?.user as { role?: string } | undefined)?.role as AdminRole) || null

  const visibleItems = ALL_NAV_ITEMS.filter(
    (item) => item.permission === null || can(role, item.permission)
  )

  const roleLabel = role === "admin" ? "Администратор" : role === "manager" ? "Менеджер" : ""

  return (
    <aside className="w-64 bg-white border-r border-border min-h-screen flex flex-col">
      <div className="p-6 border-b border-border">
        <Link href="/admin" className="text-lg font-sans font-bold text-primary">
          Millor Admin
        </Link>
        {roleLabel && (
          <p className="text-xs text-muted-foreground mt-1">
            {roleLabel}
            {(session?.user as { name?: string } | undefined)?.name
              ? ` · ${(session?.user as { name: string }).name}`
              : ""}
          </p>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href))
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
