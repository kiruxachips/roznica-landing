"use client"

import { useRef } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import type { QuizOption } from "./questions"

interface QuizStepProps {
  title: string
  subtitle?: string
  options: QuizOption[]
  selected: string | undefined
  onSelect: (id: string) => void
}

export function QuizStep({ title, subtitle, options, selected, onSelect }: QuizStepProps) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(e: React.KeyboardEvent, index: number) {
    const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"]
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const delta = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1
    const next = (index + delta + options.length) % options.length
    btnRefs.current[next]?.focus()
    onSelect(options[next].id)
  }

  return (
    <div className="animate-fade-in">
      <h2 className="font-serif text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mb-2">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
          {subtitle}
        </p>
      )}

      <div
        role="radiogroup"
        aria-label={title}
        className={cn(
          "grid gap-2.5 sm:gap-3",
          options.length <= 4 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
        )}
      >
        {options.map((opt, i) => {
          const active = selected === opt.id
          return (
            <button
              key={opt.id}
              ref={(el) => { btnRefs.current[i] = el }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active || (!selected && i === 0) ? 0 : -1}
              onKeyDown={(e) => handleKeyDown(e, i)}
              onClick={() => onSelect(opt.id)}
              className={cn(
                "text-left p-3 sm:p-4 rounded-xl border-2 transition-all flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-primary/40",
                active
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40 hover:bg-secondary/30"
              )}
            >
              {opt.iconSrc ? (
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                    active ? "bg-primary/10" : "bg-secondary/60"
                  )}
                >
                  <Image
                    src={opt.iconSrc}
                    alt=""
                    width={32}
                    height={32}
                    className="w-7 h-7 opacity-80"
                  />
                </div>
              ) : (
                <div
                  className={cn(
                    "w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 transition-colors flex items-center justify-center",
                    active ? "border-primary bg-primary" : "border-border"
                  )}
                >
                  {active && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm sm:text-base font-semibold", active && "text-primary")}>
                  {opt.label}
                </p>
                {opt.hint && (
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 leading-snug">
                    {opt.hint}
                  </p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
