"use client"

import { useState, type ReactNode } from "react"

interface Tab {
  id: string
  label: string
  content: ReactNode
}

interface Props {
  tabs: Tab[]
  defaultTab?: string
}

export function DeliveryPageTabs({ tabs, defaultTab }: Props) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.id || "")
  const current = tabs.find((t) => t.id === active) || tabs[0]

  if (!current) return null

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              active === t.id
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{current.content}</div>
    </div>
  )
}
