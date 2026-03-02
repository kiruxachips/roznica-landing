import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { OrderStatusBadge } from "./OrderStatusBadge"

interface OrderCardProps {
  id: string
  orderNumber: string
  status: string
  total: number
  itemCount: number
  createdAt: Date
}

export function OrderCard({ id, orderNumber, status, total, itemCount, createdAt }: OrderCardProps) {
  const date = new Date(createdAt).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <Link
      href={`/account/orders/${id}`}
      className="block bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">{orderNumber}</span>
          <OrderStatusBadge status={status} />
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{date}</span>
        <div className="flex items-center gap-4">
          <span>{itemCount} {itemCount === 1 ? "товар" : itemCount < 5 ? "товара" : "товаров"}</span>
          <span className="font-medium text-foreground">{total}₽</span>
        </div>
      </div>
    </Link>
  )
}
