import { cn } from "@/lib/utils"

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Новый", className: "bg-blue-100 text-blue-700" },
  paid: { label: "Оплачен", className: "bg-emerald-100 text-emerald-700" },
  confirmed: { label: "Подтверждён", className: "bg-amber-100 text-amber-700" },
  shipped: { label: "Отправлен", className: "bg-purple-100 text-purple-700" },
  delivered: { label: "Доставлен", className: "bg-green-100 text-green-700" },
  payment_failed: { label: "Ошибка оплаты", className: "bg-orange-100 text-orange-700" },
  cancelled: { label: "Отменён", className: "bg-red-100 text-red-700" },
}

export function OrderStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: "bg-gray-100 text-gray-700" }

  return (
    <span className={cn("inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium", config.className)}>
      {config.label}
    </span>
  )
}
