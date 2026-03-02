import { MapPin, Mountain, Sprout, Factory } from "lucide-react"

interface ProductMetaProps {
  origin: string | null
  region: string | null
  altitude: string | null
  roastLevel: string | null
  processingMethod: string | null
  farm: string | null
}

export function ProductMeta({ origin, region, altitude, roastLevel, processingMethod, farm }: ProductMetaProps) {
  const items = [
    { label: "Страна", value: origin, icon: MapPin },
    { label: "Регион", value: region, icon: MapPin },
    { label: "Высота", value: altitude, icon: Mountain },
    { label: "Обжарка", value: roastLevel, icon: Sprout },
    { label: "Обработка", value: processingMethod, icon: Factory },
    { label: "Ферма", value: farm, icon: Sprout },
  ].filter((item) => item.value)

  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-start gap-2 p-3 rounded-xl bg-secondary/50">
          <item.icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-medium">{item.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
