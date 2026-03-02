import { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { ShoppingBag } from "lucide-react"
import { auth } from "@/lib/auth"
import { getOrdersByUserId } from "@/lib/dal/orders"
import { OrderCard } from "@/components/account/OrderCard"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Мои заказы | Millor Coffee",
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/login")

  const params = await searchParams
  const page = Number(params.page) || 1
  const limit = 10

  const { orders, total } = await getOrdersByUserId(session.user.id, { page, limit })
  const totalPages = Math.ceil(total / limit)

  if (orders.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-serif font-bold mb-6">Мои заказы</h1>
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <ShoppingBag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-lg font-medium mb-2">У вас пока нет заказов</p>
          <p className="text-sm text-muted-foreground mb-6">Перейдите в каталог, чтобы выбрать кофе</p>
          <Link
            href="/catalog"
            className="inline-flex h-11 px-6 items-center justify-center bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Перейти в каталог
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-serif font-bold mb-6">Мои заказы</h1>

      <div className="space-y-3">
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            id={order.id}
            orderNumber={order.orderNumber}
            status={order.status}
            total={order.total}
            itemCount={order._count.items}
            createdAt={order.createdAt}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/account/orders?page=${p}`}
              className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-medium transition-colors ${
                p === page
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-muted-foreground hover:bg-muted"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
