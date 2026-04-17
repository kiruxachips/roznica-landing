"use client"

import { useTransition } from "react"
import { retryOutboxAction } from "./actions"

export function RetryButton({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      onClick={() => start(() => retryOutboxAction(id))}
      disabled={pending}
      className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
    >
      {pending ? "Повтор..." : "Повторить"}
    </button>
  )
}
