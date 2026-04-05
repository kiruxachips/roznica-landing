"use client"

import { useEffect, useRef, useState } from "react"

interface FlavorProfileBarsProps {
  acidity: number | null
  sweetness: number | null
  bitterness: number | null
  body: number | null
}

const barItems = [
  { key: "acidity", label: "Кислотность" },
  { key: "sweetness", label: "Сладость" },
  { key: "bitterness", label: "Горечь" },
  { key: "body", label: "Тело" },
] as const

export function FlavorProfileBars({ acidity, sweetness, bitterness, body }: FlavorProfileBarsProps) {
  const values = { acidity, sweetness, bitterness, body }
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  const hasValues = barItems.some(({ key }) => values[key] !== null)
  if (!hasValues) return null

  return (
    <div ref={ref}>
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
        Профиль вкуса
      </h3>
      <div className="space-y-2.5">
        {barItems.map(({ key, label }) => {
          const value = values[key]
          if (value === null) return null
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-28 flex-shrink-0">{label}</span>
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                  style={{ width: visible ? `${value}%` : "0%" }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-8 text-right">{value}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
