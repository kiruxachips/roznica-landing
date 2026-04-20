import { getStockSnapshot, getStockMetrics } from "@/lib/dal/stock"
import { WarehouseDashboard } from "@/components/admin/WarehouseDashboard"

export default async function WarehousePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const params = await searchParams
  const statusFilter = (params.status as "all" | "in_stock" | "low" | "out") || "all"

  const [snapshot, metrics] = await Promise.all([
    getStockSnapshot({ status: statusFilter, search: params.q }),
    getStockMetrics(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Склад</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Управление остатками товаров. Приёмка поставок, коррекция, контроль порогов.
        </p>
      </div>
      <WarehouseDashboard
        snapshot={snapshot}
        metrics={metrics}
        initialFilter={statusFilter}
        initialSearch={params.q || ""}
      />
    </div>
  )
}
