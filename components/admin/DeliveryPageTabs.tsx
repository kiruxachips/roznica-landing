"use client"

import { Children, isValidElement, useState, type ReactElement, type ReactNode } from "react"

interface PanelProps {
  id: string
  label: string
  children: ReactNode
}

function Panel(_: PanelProps): null {
  return null
}

interface Props {
  children: ReactNode
  defaultTab?: string
}

export function DeliveryPageTabs({ children, defaultTab }: Props) {
  const panels = Children.toArray(children).filter(
    (c): c is ReactElement<PanelProps> => isValidElement(c) && c.type === Panel
  )
  const [active, setActive] = useState(defaultTab || panels[0]?.props.id || "")
  const current = panels.find((p) => p.props.id === active) || panels[0]

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        {panels.map((p) => (
          <button
            key={p.props.id}
            onClick={() => setActive(p.props.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              active === p.props.id
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.props.label}
          </button>
        ))}
      </div>
      <div>{current?.props.children}</div>
    </div>
  )
}

DeliveryPageTabs.Panel = Panel
