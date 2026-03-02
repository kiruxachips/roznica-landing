import { prisma } from "@/lib/prisma"
import { Package, ShoppingCart, MessageSquare, FolderTree } from "lucide-react"

export const dynamic = "force-dynamic"

async function getStats() {
  const [products, orders, reviews, categories] = await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.review.count(),
    prisma.category.count({ where: { isActive: true } }),
  ])

  const recentOrders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { _count: { select: { items: true } } },
  })

  return { products, orders, reviews, categories, recentOrders }
}

export default async function AdminDashboard() {
  const stats = await getStats()

  const cards = [
    { label: "Товары", value: stats.products, icon: Package, color: "text-blue-600 bg-blue-50" },
    { label: "Заказы", value: stats.orders, icon: ShoppingCart, color: "text-green-600 bg-green-50" },
    { label: "Отзывы", value: stats.reviews, icon: MessageSquare, color: "text-amber-600 bg-amber-50" },
    { label: "Категории", value: stats.categories, icon: FolderTree, color: "text-purple-600 bg-purple-50" },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Дашборд</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
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
