import { getStockSnapshot, getStockMetrics, getStockFacets } from "@/lib/dal/stock"
import { WarehouseDashboard } from "@/components/admin/WarehouseDashboard"

export default async function WarehousePage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    q?: string
    category?: string
    type?: string
    weight?: string
    inactive?: string
  }>
}) {
  const params = await searchParams
  const statusFilter = (params.status as "all" | "in_stock" | "low" | "out") || "all"
  const weightGrams = params.weight ? parseInt(params.weight) : undefined
  const includeInactive = params.inactive === "1"

  const [snapshot, metrics, facets] = await Promise.all([
    getStockSnapshot({
      status: statusFilter,
      search: params.q,
      categoryId: params.category || undefined,
      productType: params.type || undefined,
      weightGrams: weightGrams && weightGrams > 0 ? weightGrams : undefined,
      includeInactive,
    }),
    getStockMetrics(),
    getStockFacets(),
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
        facets={facets}
        initialFilters={{
          status: statusFilter,
          search: params.q || "",
          categoryId: params.category || "",
          productType: params.type || "",
          weightGrams: weightGrams && weightGrams > 0 ? weightGrams : 0,
          includeInactive,
        }}
      />
    </div>
  )
}
