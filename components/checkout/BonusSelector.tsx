"use client"

import { useState, useEffect } from "react"
import { Gift } from "lucide-react"

interface Props {
  maxBonusAmount: number
  onBonusChange: (amount: number) => void
}

export function BonusSelector({ maxBonusAmount, onBonusChange }: Props) {
  const [balance, setBalance] = useState(0)
  const [enabled, setEnabled] = useState(false)
  const [amount, setAmount] = useState(0)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/bonuses/balance")
      .then((r) => r.json())
      .then((data) => {
        setBalance(data.balance || 0)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded || balance <= 0) return null

  const maxCanUse = Math.min(balance, maxBonusAmount)

  function handleToggle() {
    if (enabled) {
      setEnabled(false)
      setAmount(0)
      onBonusChange(0)
    } else {
      setEnabled(true)
      const val = maxCanUse
      setAmount(val)
      onBonusChange(val)
    }
  }

  function handleAmountChange(val: string) {
    const num = Math.max(0, Math.min(maxCanUse, parseInt(val) || 0))
    setAmount(num)
    onBonusChange(num)
  }

  return (
    <div className="bg-amber-50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium">Списать бонусы</span>
          <span className="text-xs text-muted-foreground">(баланс: {balance}₽)</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
            enabled ? "bg-amber-500" : "bg-muted"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="number"
            min={0}
            max={maxCanUse}
            value={amount}
            onChange={(e) => handleAmountChange(e.target.value)}
            className="w-24 h-9 px-3 rounded-lg border border-amber-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-sm text-muted-foreground">
            из {maxCanUse}₽ (макс. 50% заказа)
          </span>
        </div>
      )}
    </div>
  )
}
