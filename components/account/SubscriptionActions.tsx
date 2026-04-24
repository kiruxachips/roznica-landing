"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pause, Play, X } from "lucide-react"
import {
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
} from "@/lib/actions/subscriptions"

export function SubscriptionActions({
  subscriptionId,
  status,
}: {
  subscriptionId: string
  status: "active" | "paused"
}) {
  const router = useRouter()
  const [loading, startTransition] = useTransition()
  const [confirming, setConfirming] = useState<"cancel" | null>(null)

  function runAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await action()
      if (!res.ok) alert(res.error || "Ошибка")
      else router.refresh()
    })
  }

  if (confirming === "cancel") {
    return (
      <div className="flex flex-col gap-1.5 shrink-0">
        <p className="text-xs text-muted-foreground max-w-[140px]">Точно отменить?</p>
        <button
          onClick={() => {
            runAction(() => cancelSubscription(subscriptionId))
            setConfirming(null)
          }}
          disabled={loading}
          className="h-8 px-3 bg-red-600 text-white rounded-lg text-xs font-medium disabled:opacity-60"
        >
          Да, отменить
        </button>
        <button
          onClick={() => setConfirming(null)}
          className="h-8 px-3 border border-border rounded-lg text-xs"
        >
          Нет
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {status === "active" && (
        <button
          onClick={() =>
            runAction(() => {
              // Пауза на 14 дней по умолчанию.
              const until = new Date(Date.now() + 14 * 86_400_000)
              return pauseSubscription(subscriptionId, until)
            })
          }
          disabled={loading}
          title="Пауза на 14 дней"
          className="h-8 w-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center disabled:opacity-60"
        >
          <Pause className="w-4 h-4" />
        </button>
      )}
      {status === "paused" && (
        <button
          onClick={() => runAction(() => resumeSubscription(subscriptionId))}
          disabled={loading}
          title="Возобновить"
          className="h-8 w-8 rounded-lg border border-primary bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center disabled:opacity-60"
        >
          <Play className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={() => setConfirming("cancel")}
        title="Отменить"
        className="h-8 w-8 rounded-lg border border-border hover:bg-red-50 hover:border-red-200 hover:text-red-700 flex items-center justify-center"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
