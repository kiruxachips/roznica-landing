const methodData: Record<string, { label: string; icon: string }> = {
  espresso: { label: "Эспрессо", icon: "E" },
  filter: { label: "Фильтр", icon: "F" },
  "french-press": { label: "Френч-пресс", icon: "FP" },
  turka: { label: "Турка", icon: "T" },
  aeropress: { label: "Аэропресс", icon: "A" },
  moka: { label: "Мока", icon: "M" },
}

export function BrewingMethods({ methods }: { methods: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
        Способы заваривания
      </h3>
      <div className="flex flex-wrap gap-3">
        {methods.map((method) => {
          const data = methodData[method]
          if (!data) return null
          return (
            <div
              key={method}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary text-sm"
              title={data.label}
            >
              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                {data.icon}
              </span>
              <span className="text-muted-foreground">{data.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
