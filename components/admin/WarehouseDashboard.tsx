"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { StockSnapshotRow } from "@/lib/dal/stock"
import { WarehouseStockEditor } from "./WarehouseStockEditor"
import { BulkStockIntake } from "./BulkStockIntake"
import { StockHistoryPanel } from "./StockHistoryPanel"
import { setLowThresholdAction } from "@/lib/actions/stock"

interface Metrics {
  totalVariants: number
  totalStock: number
  outOfStock: number
  lowStock: number
  intakesLast7Days: number
}

interface Facets {
  categories: { id: string; name: string }[]
  weights: { grams: number; label: string }[]
  productTypes: string[]
}

type FilterStatus = "all" | "in_stock" | "low" | "out"

interface Filters {
  status: FilterStatus
  search: string
  categoryId: string
  productType: string
  weightGrams: number   // 0 = «любой»
  includeInactive: boolean
}

interface Props {
  snapshot: StockSnapshotRow[]
  metrics: Metrics
  facets: Facets
  initialFilters: Filters
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  coffee: "Кофе",
  tea: "Чай",
  instant: "Растворимый",
}

export function WarehouseDashboard({ snapshot, metrics, facets, initialFilters }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [editingRow, setEditingRow] = useState<StockSnapshotRow | null>(null)
  const [historyVariantId, setHistoryVariantId] = useState<string | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [expandAll, setExpandAll] = useState(true)
  const [collapsedProducts, setCollapsedProducts] = useState<Set<string>>(new Set())

  // Группировка строк по товару (id + имя + категория + тип)
  const grouped = useMemo(() => {
    const byProduct = new Map<
      string,
      {
        productId: string
        productName: string
        productSlug: string
        productType: string
        categoryName: string
        rows: StockSnapshotRow[]
      }
    >()
    for (const row of snapshot) {
      const existing = byProduct.get(row.productId)
      if (existing) {
        existing.rows.push(row)
      } else {
        byProduct.set(row.productId, {
          productId: row.productId,
          productName: row.productName,
          productSlug: row.productSlug,
          productType: row.productType,
          categoryName: row.categoryName,
          rows: [row],
        })
      }
    }
    return Array.from(byProduct.values())
  }, [snapshot])

  function update<K extends keyof Filters>(key: K, value: Filters[K]) {
    const next = { ...filters, [key]: value }
    setFilters(next)
    applyFilters(next)
  }

  function applyFilters(f: Filters) {
    const params = new URLSearchParams()
    if (f.status !== "all") params.set("status", f.status)
    if (f.search) params.set("q", f.search)
    if (f.categoryId) params.set("category", f.categoryId)
    if (f.productType) params.set("type", f.productType)
    if (f.weightGrams > 0) params.set("weight", String(f.weightGrams))
    if (f.includeInactive) params.set("inactive", "1")
    startTransition(() => router.push(`/admin/warehouse?${params.toString()}`))
  }

  function resetFilters() {
    const def: Filters = {
      status: "all",
      search: "",
      categoryId: "",
      productType: "",
      weightGrams: 0,
      includeInactive: false,
    }
    setFilters(def)
    applyFilters(def)
  }

  async function handleThresholdChange(variantId: string, value: string) {
    const parsed = value.trim() === "" ? null : parseInt(value)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    await setLowThresholdAction(variantId, parsed)
    router.refresh()
  }

  function toggleProduct(productId: string) {
    setCollapsedProducts((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  function toggleAll() {
    if (expandAll) {
      setCollapsedProducts(new Set(grouped.map((g) => g.productId)))
      setExpandAll(false)
    } else {
      setCollapsedProducts(new Set())
      setExpandAll(true)
    }
  }

  const anyFilterActive =
    filters.status !== "all" ||
    filters.search !== "" ||
    filters.categoryId !== "" ||
    filters.productType !== "" ||
    filters.weightGrams > 0 ||
    filters.includeInactive

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Позиций" value={metrics.totalVariants} />
        <MetricCard label="Суммарный остаток" value={metrics.totalStock} suffix="шт" />
        <MetricCard
          label="Нет в наличии"
          value={metrics.outOfStock}
          variant={metrics.outOfStock > 0 ? "danger" : "default"}
        />
        <MetricCard
          label="Низкий остаток"
          value={metrics.lowStock}
          variant={metrics.lowStock > 0 ? "warning" : "default"}
        />
      </div>

      {/* Top bar: status tabs + bulk button */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-muted p-1 rounded-xl">
          {(["all", "in_stock", "low", "out"] as const).map((s) => {
            const labels: Record<FilterStatus, string> = {
              all: "Все",
              in_stock: "В наличии",
              low: "Низкий",
              out: "Нет",
            }
            return (
              <button
                key={s}
                onClick={() => update("status", s)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  filters.status === s
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {labels[s]}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setBulkMode(true)}
          className="ml-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Массовый приход
        </button>
      </div>

      {/* Filters row */}
      <div className="bg-white rounded-xl border border-border p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs text-muted-foreground mb-1">Поиск (название / SKU)</label>
          <input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") update("search", filters.search)
            }}
            onBlur={() => {
              if (filters.search !== initialFilters.search) update("search", filters.search)
            }}
            placeholder="Начните вводить..."
            className="w-full h-10 px-3 rounded-lg border border-input text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Категория</label>
          <select
            value={filters.categoryId}
            onChange={(e) => update("categoryId", e.target.value)}
            className="h-10 px-3 rounded-lg border border-input text-sm min-w-[160px]"
          >
            <option value="">Все</option>
            {facets.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {facets.productTypes.length > 1 && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Тип</label>
            <select
              value={filters.productType}
              onChange={(e) => update("productType", e.target.value)}
              className="h-10 px-3 rounded-lg border border-input text-sm min-w-[140px]"
            >
              <option value="">Все</option>
              {facets.productTypes.map((t) => (
                <option key={t} value={t}>
                  {PRODUCT_TYPE_LABELS[t] || t}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Вес</label>
          <div className="flex gap-1 flex-wrap">
            <WeightChip
              label="Любой"
              active={filters.weightGrams === 0}
              onClick={() => update("weightGrams", 0)}
            />
            {facets.weights.map((w) => (
              <WeightChip
                key={w.grams}
                label={w.label}
                active={filters.weightGrams === w.grams}
                onClick={() => update("weightGrams", w.grams)}
              />
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm ml-auto">
          <input
            type="checkbox"
            checked={filters.includeInactive}
            onChange={(e) => update("includeInactive", e.target.checked)}
            className="accent-primary"
          />
          <span className="text-muted-foreground">Показать скрытые товары</span>
        </label>

        {anyFilterActive && (
          <button
            onClick={resetFilters}
            className="h-10 px-3 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
          >
            Сбросить
          </button>
        )}
      </div>

      {/* Group toggle + summary */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          Найдено <b className="text-foreground">{grouped.length}</b>{" "}
          {grouped.length === 1 ? "товар" : "товаров"},{" "}
          <b className="text-foreground">{snapshot.length}</b>{" "}
          {snapshot.length === 1 ? "вариант" : "вариантов"}
        </span>
        {grouped.length > 0 && (
          <button
            onClick={toggleAll}
            className="ml-auto text-primary hover:underline"
          >
            {expandAll ? "Свернуть всё" : "Развернуть всё"}
          </button>
        )}
      </div>

      {/* Grouped product cards */}
      <div className="space-y-3">
        {grouped.length === 0 && (
          <div className="bg-white rounded-xl border border-border p-10 text-center text-muted-foreground">
            Ничего не найдено
          </div>
        )}
        {grouped.map((group) => {
          const isCollapsed = collapsedProducts.has(group.productId)
          const totalProductStock = group.rows.reduce((s, r) => s + r.stock, 0)
          const anyOut = group.rows.some((r) => r.status === "out")
          const anyLow = group.rows.some((r) => r.status === "low")
          const productBadge: "out" | "low" | "ok" = anyOut ? "out" : anyLow ? "low" : "ok"
          return (
            <div key={group.productId} className="bg-white rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => toggleProduct(group.productId)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{group.productName}</span>
                    <TypeBadge type={group.productType} />
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {group.categoryName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {group.rows.length}{" "}
                    {group.rows.length === 1 ? "вариант" : "вариантов"} · всего на складе{" "}
                    <b className="text-foreground tabular-nums">{totalProductStock}</b>
                  </p>
                </div>
                <ProductBadge badge={productBadge} />
                <Link
                  href={`/admin/products/${group.productId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-primary hover:underline"
                >
                  Карточка товара →
                </Link>
              </button>

              {!isCollapsed && (
                <div className="border-t border-border overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/20 text-muted-foreground">
                      <tr>
                        <th className="text-left px-4 py-2 font-medium">Вариант</th>
                        <th className="text-right px-4 py-2 font-medium">Остаток</th>
                        <th className="text-right px-4 py-2 font-medium">Порог</th>
                        <th className="text-left px-4 py-2 font-medium">Статус</th>
                        <th className="text-left px-4 py-2 font-medium">Посл. изменение</th>
                        <th className="text-right px-4 py-2 font-medium">Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.variantId} className="border-t border-border hover:bg-muted/10">
                          <td className="px-4 py-2.5">
                            <span className="font-medium">{row.variantWeight}</span>
                            {row.variantSku && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                SKU: {row.variantSku}
                              </span>
                            )}
                            {!row.variantIsActive && (
                              <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                вариант скрыт
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                            {row.stock}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <input
                              type="number"
                              min={0}
                              defaultValue={row.lowStockThreshold ?? ""}
                              placeholder="—"
                              onBlur={(e) => {
                                if (e.target.value !== (row.lowStockThreshold?.toString() ?? "")) {
                                  handleThresholdChange(row.variantId, e.target.value)
                                }
                              }}
                              className="w-16 h-8 px-2 text-right rounded border border-input text-sm tabular-nums"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={row.status} />
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">
                            {row.lastChangeAt
                              ? new Date(row.lastChangeAt).toLocaleString("ru-RU")
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right space-x-3 whitespace-nowrap">
                            <button
                              onClick={() => setEditingRow(row)}
                              className="text-primary hover:underline text-sm"
                            >
                              Приход / коррекция
                            </button>
                            <button
                              onClick={() => setHistoryVariantId(row.variantId)}
                              className="text-muted-foreground hover:text-foreground text-sm"
                            >
                              История
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {editingRow && (
        <WarehouseStockEditor
          row={editingRow}
          onClose={() => {
            setEditingRow(null)
            router.refresh()
          }}
        />
      )}

      {historyVariantId && (
        <StockHistoryPanel
          variantId={historyVariantId}
          onClose={() => setHistoryVariantId(null)}
        />
      )}

      {bulkMode && (
        <BulkStockIntake
          rows={snapshot.filter((r) => r.variantIsActive && r.productIsActive)}
          onClose={() => {
            setBulkMode(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function MetricCard({
  label,
  value,
  suffix,
  variant = "default",
}: {
  label: string
  value: number
  suffix?: string
  variant?: "default" | "warning" | "danger"
}) {
  const bg =
    variant === "danger"
      ? "bg-red-50 border-red-200"
      : variant === "warning"
      ? "bg-amber-50 border-amber-200"
      : "bg-white border-border"
  const color =
    variant === "danger" ? "text-red-700" : variant === "warning" ? "text-amber-700" : "text-foreground"
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold tabular-nums mt-1 ${color}`}>
        {value.toLocaleString("ru-RU")} {suffix && <span className="text-sm font-normal">{suffix}</span>}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: "in_stock" | "low" | "out" }) {
  const config = {
    in_stock: { label: "В наличии", cls: "bg-green-50 text-green-700" },
    low: { label: "Низкий", cls: "bg-amber-50 text-amber-700" },
    out: { label: "Нет", cls: "bg-red-50 text-red-700" },
  }
  const { label, cls } = config[status]
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
}

function ProductBadge({ badge }: { badge: "out" | "low" | "ok" }) {
  if (badge === "out") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-medium whitespace-nowrap">
        Есть позиции «нет»
      </span>
    )
  }
  if (badge === "low") {
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium whitespace-nowrap">
        Низкий остаток
      </span>
    )
  }
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium whitespace-nowrap">
      В наличии
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const label = PRODUCT_TYPE_LABELS[type] || type
  const colorMap: Record<string, string> = {
    coffee: "bg-amber-50 text-amber-800",
    tea: "bg-emerald-50 text-emerald-700",
    instant: "bg-blue-50 text-blue-700",
  }
  const cls = colorMap[type] || "bg-gray-100 text-gray-700"
  return <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
}

function WeightChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 px-3 rounded-lg border text-sm transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-white border-input hover:bg-muted"
      }`}
    >
      {label}
    </button>
  )
}
