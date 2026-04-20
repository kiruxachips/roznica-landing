"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { retryEmailDispatchAction } from "@/lib/actions/email-dispatch"

interface Row {
  id: string
  orderId: string | null
  kind: string
  recipient: string
  status: string
  attempts: number
  nextAttemptAt: string
  messageId: string | null
  error: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

const statusStyles: Record<string, string> = {
  sent: "bg-green-50 text-green-700",
  pending: "bg-amber-50 text-amber-700",
  failed: "bg-red-50 text-red-700",
  dead: "bg-gray-900 text-white",
}

const statusLabels: Record<string, string> = {
  sent: "Отправлено",
  pending: "Ожидает",
  failed: "Ошибка",
  dead: "Не дошло",
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export function EmailDispatchTable({ rows }: { rows: Row[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [retrying, setRetrying] = useState<string | null>(null)

  function handleRetry(id: string) {
    if (!confirm("Попробовать отправить повторно?")) return
    setRetrying(id)
    startTransition(async () => {
      try {
        await retryEmailDispatchAction(id)
      } catch (e) {
        alert(e instanceof Error ? e.message : "Ошибка")
      } finally {
        setRetrying(null)
      }
    })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2.5 font-medium">Создано</th>
            <th className="text-left px-3 py-2.5 font-medium">Заказ</th>
            <th className="text-left px-3 py-2.5 font-medium">Тип</th>
            <th className="text-left px-3 py-2.5 font-medium">Получатель</th>
            <th className="text-left px-3 py-2.5 font-medium">Статус</th>
            <th className="text-left px-3 py-2.5 font-medium">Попыток</th>
            <th className="text-left px-3 py-2.5 font-medium">След. попытка</th>
            <th className="w-32 px-3 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const canRetry = r.status === "failed" || r.status === "dead" || r.status === "pending"
            const isExpanded = expanded === r.id
            return (
              <>
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground text-xs">{fmtDate(r.createdAt)}</td>
                  <td className="px-3 py-2">
                    {r.orderId ? (
                      <Link
                        href={`/admin/orders/${r.orderId}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {r.orderId.slice(0, 10)}…
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs font-mono">{r.kind}</td>
                  <td className="px-3 py-2 text-xs">{r.recipient}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${statusStyles[r.status] || "bg-gray-100"}`}>
                      {statusLabels[r.status] || r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">{r.attempts}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">
                    {r.status === "sent" ? (r.sentAt ? fmtDate(r.sentAt) : "—") : fmtDate(r.nextAttemptAt)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => setExpanded(isExpanded ? null : r.id)}
                        className="px-2 py-1 text-xs rounded border border-border hover:bg-muted"
                      >
                        {isExpanded ? "Скрыть" : "Детали"}
                      </button>
                      {canRetry && (
                        <button
                          onClick={() => handleRetry(r.id)}
                          disabled={pending && retrying === r.id}
                          className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {pending && retrying === r.id ? "…" : "Retry"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-t border-border bg-muted/20">
                    <td colSpan={8} className="px-3 py-3">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="text-muted-foreground">ID</p>
                          <p className="font-mono break-all">{r.id}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Message ID</p>
                          <p className="font-mono break-all">{r.messageId || "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Отправлено</p>
                          <p>{r.sentAt ? fmtDate(r.sentAt) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Обновлено</p>
                          <p>{fmtDate(r.updatedAt)}</p>
                        </div>
                        {r.error && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground">Ошибка</p>
                            <p className="font-mono text-red-700 break-words whitespace-pre-wrap">{r.error}</p>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">Писем не найдено</div>
      )}
    </div>
  )
}
