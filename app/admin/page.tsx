import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { Package, ShoppingCart, MessageSquare, FolderTree, AlertTriangle, Boxes } from "lucide-react"
import { getStockMetrics } from "@/lib/dal/stock"
import { unstable_cache } from "next/cache"

export const dynamic = "force-dynamic"

// Дашборд открывают часто — recentOrders кэшируем на 60 с, этого достаточно
// для оперативного контроля и убирает N*6 запросов в минуту при активной работе.
const getCachedRecentOrders = unstable_cache(
  () =>
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { _count: { select: { items: true } } },
    }),
  ["admin-dashboard-recent-orders"],
  { revalidate: 60 }
)

async function getStats() {
  const [products, orders, reviews, categories, stock, recentOrders] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.review.count(),
    prisma.category.count({ where: { isActive: true } }),
    getStockMetrics(),
    getCachedRecentOrders(),
  ])

  return { products, orders, reviews, categories, stock, recentOrders }
}

export default async function AdminDashboard() {
  const stats = await getStats()

  const cards = [
    { label: "Товары", value: stats.products, icon: Package, color: "text-blue-600 bg-blue-50" },
    { label: "Заказы", value: stats.orders, icon: ShoppingCart, color: "text-green-600 bg-green-50" },
    { label: "Отзывы", value: stats.reviews, icon: MessageSquare, color: "text-amber-600 bg-amber-50" },
    { label: "Категории", value: stats.categories, icon: FolderTree, color: "text-purple-600 bg-purple-50" },
  ]

  const stockCards = [
    {
      label: "Суммарный остаток",
      value: stats.stock.totalStock,
      icon: Boxes,
      color: "text-slate-600 bg-slate-50",
      href: "/admin/warehouse",
    },
    {
      label: "Нет в наличии",
      value: stats.stock.outOfStock,
      icon: AlertTriangle,
      color: stats.stock.outOfStock > 0 ? "text-red-600 bg-red-50" : "text-muted-foreground bg-muted/40",
      href: "/admin/warehouse?status=out",
    },
    {
      label: "Низкий остаток",
      value: stats.stock.lowStock,
      icon: AlertTriangle,
      color: stats.stock.lowStock > 0 ? "text-amber-600 bg-amber-50" : "text-muted-foreground bg-muted/40",
      href: "/admin/warehouse?status=low",
    },
    {
      label: "Поставки за 7 дней",
      value: stats.stock.intakesLast7Days,
      icon: Package,
      color: "text-green-600 bg-green-50",
      href: "/admin/warehouse",
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Дашборд</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-6 shadow-sm border border-border">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-sm text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {stockCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="bg-white rounded-xl p-6 shadow-sm border border-border hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${card.color}`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{card.value.toLocaleString("ru-RU")}</p>
                <p className="text-sm text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {stats.recentOrders.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border">
          <h2 className="text-lg font-semibold mb-4">Последние заказы</h2>
          <div className="space-y-3">
            {stats.recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <span className="font-medium">{order.orderNumber}</span>
                  <span className="text-sm text-muted-foreground ml-3">{order.customerName}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium">{order.total}₽</span>
                  <StatusBadge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700",
    confirmed: "bg-blue-50 text-blue-700",
    shipped: "bg-purple-50 text-purple-700",
    delivered: "bg-green-50 text-green-700",
    cancelled: "bg-red-50 text-red-700",
  }
  const labels: Record<string, string> = {
    pending: "Новый",
    confirmed: "Подтверждён",
    shipped: "Отправлен",
    delivered: "Доставлен",
    cancelled: "Отменён",
  }

  return (
    <span className={`px-2 py-1 rounded-md text-xs font-medium ${styles[status] ?? "bg-gray-50 text-gray-700"}`}>
      {labels[status] ?? status}
    </span>
  )
}
