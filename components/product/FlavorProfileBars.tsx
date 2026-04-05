"use client"

import { useEffect, useRef, useState } from "react"

interface FlavorProfileBarsProps {
  acidity: number | null
  sweetness: number | null
  bitterness: number | null
  body: number | null
}

const barItems = [
  { key: "acidity", label: "Кислотность", color: "bg-amber-500" },
  { key: "sweetness", label: "Сладость", color: "bg-emerald-500" },
  { key: "bitterness", label: "Горечь", color: "bg-rose-500" },
  { key: "body", label: "Тело", color: "bg-sky-600" },
] as const

function getIntensity(value: number): string {
  if (value <= 25) return "Низкая"
  if (value <= 50) return "Средняя"
  if (value <= 75) return "Высокая"
  return "Яркая"
}

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
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">
        Профиль вкуса
      </h3>
      <div className="space-y-3">
        {barItems.map(({ key, label, color }) => {
          const value = values[key]
          if (value === null) return null
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground w-28 flex-shrink-0">{label}</span>
              <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`}
                  style={{ width: visible ? `${value}%` : "0%" }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-16 text-right">{getIntensity(value)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
