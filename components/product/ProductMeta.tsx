import { MapPin, Mountain, Sprout, Factory, Flame, Home, Package } from "lucide-react"

interface ProductMetaProps {
  productType?: string
  productForm?: string | null
  origin: string | null
  region: string | null
  altitude: string | null
  roastLevel: string | null
  processingMethod: string | null
  farm: string | null
  compact?: boolean
}

export function ProductMeta({
  productType = "coffee",
  productForm,
  origin,
  region,
  altitude,
  roastLevel,
  processingMethod,
  farm,
  compact,
}: ProductMetaProps) {
  // Label for roastLevel varies by product type
  const roastLabel =
    productType === "tea" ? "Степень окисления" : "Обжарка"

  const items = [
    { label: "Страна", value: origin, icon: MapPin },
    { label: "Регион", value: region, icon: MapPin },
    { label: "Высота", value: altitude, icon: Mountain },
    { label: roastLabel, value: roastLevel, icon: Flame },
    { label: "Обработка", value: processingMethod, icon: Factory },
    { label: "Форма", value: productForm ?? null, icon: Package },
    { label: "Ферма", value: farm, icon: Home },
  ].filter((item) => item.value)

  if (items.length === 0) return null

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/60 border border-border/50">
            <item.icon className="w-3 h-3 text-primary flex-shrink-0" />
            <span className="text-xs text-muted-foreground">{item.label}:</span>
            <span className="text-xs font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
        Характеристики
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-3 p-4 rounded-2xl bg-secondary/40 border border-border/30">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <item.icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-sm font-semibold mt-0.5">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
