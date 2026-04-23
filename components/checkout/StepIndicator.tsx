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

  return (
    <nav
      aria-label="Шаги оформления"
      className="bg-white rounded-2xl p-3 sm:p-4 shadow-sm mb-4 sm:mb-5"
    >
      <ol className="flex items-center justify-between gap-1 sm:gap-2">
        {STEPS.map((s, i) => {
          const isCurrent = step === s.key
          const isDone = completed[s.key]
          const isClickable = isDone || isCurrent
          return (
            <li key={s.key} className="flex items-center flex-1 min-w-0">
              <button
                type="button"
                onClick={() => isClickable && setStep(s.key)}
                disabled={!isClickable}
                className={`flex items-center gap-2 sm:gap-3 min-w-0 transition-colors ${
                  isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full font-semibold text-sm shrink-0 transition-colors ${
                    isDone
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                      ? "bg-primary/10 text-primary border-2 border-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <Check className="w-4 h-4" strokeWidth={3} /> : s.short}
                </span>
                <span
                  className={`font-medium text-sm truncate hidden sm:block ${
                    isCurrent ? "text-foreground" : isDone ? "text-foreground/80" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </button>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 sm:mx-3 rounded-full transition-colors ${
                    completed[s.key] ? "bg-primary" : "bg-muted"
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
