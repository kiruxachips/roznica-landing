"use client"

import { Check } from "lucide-react"
import { useCheckoutWizard, type CheckoutStep } from "@/lib/store/checkout-wizard"

const STEPS: { key: CheckoutStep; label: string; short: string }[] = [
  { key: "contact", label: "Контакты", short: "1" },
  { key: "delivery", label: "Доставка", short: "2" },
  { key: "payment", label: "Оплата", short: "3" },
]

export function StepIndicator() {
  const step = useCheckoutWizard((s) => s.step)
  const completed = useCheckoutWizard((s) => s.completed)
  const setStep = useCheckoutWizard((s) => s.setStep)

  const currentIndex = STEPS.findIndex((s) => s.key === step)

  return (
    <nav
      aria-label="Шаги оформления"
      className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm mb-4 sm:mb-5"
    >
      <ol className="flex items-center justify-between gap-1 sm:gap-2">
        {STEPS.map((s, i) => {
          const isCurrent = step === s.key
          const isDone = completed[s.key] && !isCurrent
          const isClickable = completed[s.key] || isCurrent
          // Коннектор между i и i+1 — зелёный только если i-шаг пройден
          // И текущий шаг >= i+1. Это предотвращает "обгон" линии прогресса
          // при возврате с payment на delivery (раньше линия оставалась
          // полностью зелёной, как будто юзер всё ещё на оплате).
          const connectorReached = i < currentIndex
          return (
            <li key={s.key} className="flex items-center flex-1 min-w-0">
              <button
                type="button"
                onClick={() => isClickable && setStep(s.key)}
                disabled={!isClickable}
                className={`flex items-center gap-2 sm:gap-3 min-w-0 transition-colors ${
                  isClickable ? "cursor-pointer" : "cursor-not-allowed"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full font-semibold text-sm shrink-0 transition-colors ${
                    isCurrent
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                      : isDone
                      ? "bg-primary/80 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : s.short}
                </span>
                <span
                  className={`font-medium text-sm truncate hidden sm:block ${
                    isCurrent
                      ? "text-foreground font-semibold"
                      : isDone
                      ? "text-foreground/70"
                      : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 sm:mx-3 rounded-full transition-colors ${
                    connectorReached ? "bg-primary/80" : "bg-muted"
                  }`}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
