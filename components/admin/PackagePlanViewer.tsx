import { Package } from "lucide-react"

interface Pkg {
  length: number
  width: number
  height: number
  weight: number
  presetCode?: string
}

interface Props {
  plan: unknown
  totalWeight: number | null
}

function isPkg(p: unknown): p is Pkg {
  if (!p || typeof p !== "object") return false
  const o = p as Record<string, unknown>
  return typeof o.length === "number" && typeof o.width === "number" && typeof o.height === "number" && typeof o.weight === "number"
}

export function PackagePlanViewer({ plan, totalWeight }: Props) {
  const packages: Pkg[] = Array.isArray(plan) ? plan.filter(isPkg) : []
  if (packages.length === 0) {
    return (
      <div className="col-span-2 text-sm text-muted-foreground">
        План упаковки не сохранён (заказ создан до внедрения умной упаковки или без товаров).
      </div>
    )
  }

  const sum = totalWeight ?? packages.reduce((s, p) => s + p.weight, 0)
  const multiBox = packages.length > 1

  return (
    <div className="col-span-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-muted-foreground text-sm">Упаковка:</span>
        <span className="font-medium text-sm">
          {packages.length} {packages.length === 1 ? "коробка" : "коробки"} · брутто {sum} г
        </span>
        {multiBox && (
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">
            мультикоробка
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {packages.map((p, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 text-sm"
          >
            <Package className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-medium">
              {p.presetCode ? `${p.presetCode} ` : ""}
              {p.length}×{p.width}×{p.height} см
            </span>
            <span className="text-muted-foreground ml-auto tabular-nums">{p.weight} г</span>
          </div>
        ))}
      </div>
    </div>
  )
}
