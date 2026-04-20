"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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

type FilterStatus = "all" | "in_stock" | "low" | "out"

interface Props {
  snapshot: StockSnapshotRow[]
  metrics: Metrics
  initialFilter: FilterStatus
  initialSearch: string
}

export function WarehouseDashboard({ snapshot, metrics, initialFilter, initialSearch }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [filter, setFilter] = useState<FilterStatus>(initialFilter)
  const [search, setSearch] = useState(initialSearch)
  const [editingRow, setEditingRow] = useState<StockSnapshotRow | null>(null)
  const [historyVariantId, setHistoryVariantId] = useState<string | null>(null)
  const [bulkMode, setBulkMode] = useState(false)

  function applyFilters(next: { status?: FilterStatus; q?: string }) {
    const params = new URLSearchParams()
    const status = next.status ?? filter
    const q = next.q ?? search
    if (status !== "all") params.set("status", status)
    if (q) params.set("q", q)
    startTransition(() => {
      router.push(`/admin/warehouse?${params.toString()}`)
    })
  }

  async function handleThresholdChange(variantId: string, value: string) {
    const parsed = value.trim() === "" ? null : parseInt(value)
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    await setLowThresholdAction(variantId, parsed)
    router.refresh()
  }

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

      {/* Filters + actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-muted p-1 rounded-xl">
          {(["all", "in_stock", "low", "out"] as const).map((s) => {
            const labels: Record<FilterStatus, string> = {
              all: "Все",
              in_stock: "В наличии",
              low: "Низкий",
              out: "Нет в наличии",
            }
            const counts: Record<FilterStatus, number> = {
              all: snapshot.length,
              in_stock: snapshot.filter((r) => r.status === "in_stock").length,
              low: metrics.lowStock,
              out: metrics.outOfStock,
            }
            return (
              <button
                key={s}
                onClick={() => {
                  setFilter(s)
                  applyFilters({ status: s })
                }}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  filter === s ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {labels[s]} {filter === s || s === "all" ? null : <span className="opacity-60">({counts[s]})</span>}
              </button>
            )
          })}
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") applyFilters({ q: search })
          }}
          placeholder="Поиск по товару или SKU"
          className="flex-1 min-w-[200px] h-10 px-3 rounded-lg border border-input text-sm"
        />

        <button
          onClick={() => setBulkMode(true)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Массовый приход
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Товар</th>
              <th className="text-left px-4 py-3 font-medium">Вариант</th>
              <th className="text-right px-4 py-3 font-medium">Остаток</th>
              <th className="text-right px-4 py-3 font-medium">Порог</th>
              <th className="text-left px-4 py-3 font-medium">Статус</th>
              <th className="text-left px-4 py-3 font-medium">Посл. изменение</th>
              <th className="text-right px-4 py-3 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Нет данных
                </td>
              </tr>
            )}
            {snapshot.map((row) => (
              <tr key={row.variantId} className="border-t border-border hover:bg-muted/20">
                <td className="px-4 py-3">
                  <Link href={`/admin/products/${row.productId}`} className="font-medium hover:underline">
                    {row.productName}
                  </Link>
                  {!row.productIsActive && (
                    <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">скрыт</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-muted-foreground">{row.variantWeight}</span>
                  {row.variantSku && <span className="ml-2 text-xs text-muted-foreground/70">· {row.variantSku}</span>}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">{row.stock}</td>
                <td className="px-4 py-3 text-right">
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
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {row.lastChangeAt ? new Date(row.lastChangeAt).toLocaleString("ru-RU") : "—"}
                </td>
                <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
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
