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
      className="block bg-white rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 min-w-0">
          <span className="font-medium text-sm">{orderNumber}</span>
          <OrderStatusBadge status={status} />
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
        <span>{date}</span>
        <div className="flex items-center gap-3 sm:gap-4">
          <span>{itemCount} {itemCount === 1 ? "товар" : itemCount < 5 ? "товара" : "товаров"}</span>
          <span className="font-medium text-foreground">{total}₽</span>
        </div>
      </div>
    </Link>
  )
}
