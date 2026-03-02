"use client"

import { useState, useTransition } from "react"
import { updateNotificationPrefs } from "@/lib/actions/notifications"

interface Props {
  initial: {
    notifyOrderStatus: boolean
    notifyPromotions: boolean
    notifyNewProducts: boolean
  }
}

export function NotificationPrefsForm({ initial }: Props) {
  const [prefs, setPrefs] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function toggle(key: keyof typeof prefs) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  function handleSave() {
    startTransition(async () => {
      await updateNotificationPrefs(prefs)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  const items = [
    {
      key: "notifyOrderStatus" as const,
      label: "Статус заказа",
      description: "Уведомления об изменении статуса ваших заказов",
    },
    {
      key: "notifyPromotions" as const,
      label: "Акции и скидки",
      description: "Информация о специальных предложениях и промокодах",
    },
    {
      key: "notifyNewProducts" as const,
      label: "Новые товары",
      description: "Уведомления о поступлении нового кофе",
    },
  ]

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center justify-between p-4 bg-white rounded-xl border border-border"
        >
          <div>
            <p className="font-medium text-sm">{item.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs[item.key]}
            onClick={() => toggle(item.key)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors ${
              prefs[item.key] ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm transition-transform ${
                prefs[item.key] ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="h-10 px-6 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isPending ? "Сохранение..." : "Сохранить"}
        </button>
        {saved && (
          <span className="text-sm text-green-600">Настройки сохранены</span>
        )}
      </div>
    </div>
  )
}
