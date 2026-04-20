"use client"

import { useEffect, useState } from "react"

interface LogRow {
  id: string
  direction: string
  source: string
  event: string
  eventId: string | null
  statusCode: number | null
  error: string | null
  durationMs: number | null
  createdAt: string
  request?: unknown
  response?: unknown
}

interface Props {
  initialLogs: LogRow[]
  sources: string[]
}

export function IntegrationLogViewer({ initialLogs, sources }: Props) {
  const [logs, setLogs] = useState(initialLogs)
  const [source, setSource] = useState<string>("all")
  const [onlyErrors, setOnlyErrors] = useState(false)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function reload() {
    setLoading(true)
    const params = new URLSearchParams()
    if (source !== "all") params.set("source", source)
    if (onlyErrors) params.set("errors", "1")
    const res = await fetch(`/api/admin/integration-logs?${params}`)
    if (res.ok) setLogs(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, onlyErrors])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="h-9 px-3 rounded-lg border border-input text-sm"
        >
          <option value="all">Все источники</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyErrors}
            onChange={(e) => setOnlyErrors(e.target.checked)}
            className="accent-primary"
          />
          Только ошибки
        </label>
        <button
          onClick={reload}
          disabled={loading}
          className="ml-auto text-sm text-primary hover:underline disabled:opacity-50"
        >
          {loading ? "Обновление..." : "Обновить"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Время</th>
              <th className="text-left px-3 py-2 font-medium">Dir</th>
              <th className="text-left px-3 py-2 font-medium">Источник</th>
              <th className="text-left px-3 py-2 font-medium">Событие</th>
              <th className="text-right px-3 py-2 font-medium">Код</th>
              <th className="text-right px-3 py-2 font-medium">ms</th>
              <th className="text-left px-3 py-2 font-medium">Ошибка</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Пусто
                </td>
              </tr>
            )}
            {logs.map((l) => {
              const isError = l.error || (l.statusCode !== null && l.statusCode >= 400)
              const isOpen = expanded === l.id
              return (
                <>
                  <tr
                    key={l.id}
                    className={`border-t border-border hover:bg-muted/20 cursor-pointer ${isError ? "bg-red-50/30" : ""}`}
                    onClick={() => setExpanded(isOpen ? null : l.id)}
                  >
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-3 py-2 text-xs">{l.direction === "inbound" ? "←" : "→"}</td>
                    <td className="px-3 py-2 font-medium">{l.source}</td>
                    <td className="px-3 py-2">{l.event}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${isError ? "text-red-700 font-semibold" : ""}`}>
                      {l.statusCode ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {l.durationMs ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-red-700 truncate max-w-xs">{l.error || "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{isOpen ? "▼" : "▶"}</td>
                  </tr>
                  {isOpen && (
                    <tr className="border-t border-border bg-muted/10">
                      <td colSpan={8} className="px-6 py-4 text-xs">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <div className="font-semibold mb-1 text-muted-foreground">Request</div>
                            <pre className="bg-white border border-border rounded p-3 overflow-x-auto max-h-64 text-[11px] leading-relaxed">
                              {l.request ? JSON.stringify(l.request, null, 2) : "(пусто)"}
                            </pre>
                          </div>
                          <div>
                            <div className="font-semibold mb-1 text-muted-foreground">Response</div>
                            <pre className="bg-white border border-border rounded p-3 overflow-x-auto max-h-64 text-[11px] leading-relaxed">
                              {l.response ? JSON.stringify(l.response, null, 2) : "(пусто)"}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
