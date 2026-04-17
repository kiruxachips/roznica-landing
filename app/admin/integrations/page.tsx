export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { RetryButton } from "./RetryButton"

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  delivered: "bg-green-50 text-green-700",
  failed: "bg-orange-50 text-orange-700",
  dead: "bg-red-50 text-red-700",
}

const directionStyles: Record<string, string> = {
  inbound: "bg-blue-50 text-blue-700",
  outbound: "bg-purple-50 text-purple-700",
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
}

function trunc(s: string, n = 120): string {
  if (!s) return ""
  return s.length > n ? s.slice(0, n) + "…" : s
}

export default async function AdminIntegrationsPage() {
  const [outbox, logs, counts] = await Promise.all([
    prisma.outboxEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.integrationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.outboxEvent.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ])

  const counters: Record<string, number> = {}
  for (const row of counts) counters[row.status] = row._count.status

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Интеграции</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Мониторинг событий между сайтом и внешними системами (millorbot, CDEK, YooKassa).
      </p>

      {/* Counters */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {(["pending", "delivered", "failed", "dead"] as const).map((s) => (
          <div key={s} className="bg-white rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{s}</p>
            <p className="text-2xl font-bold mt-1">{counters[s] || 0}</p>
          </div>
        ))}
      </div>

      {/* Outbox */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-3">Исходящая очередь (outbox)</h2>
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Создано</th>
                <th className="text-left px-4 py-3 font-medium">Topic</th>
                <th className="text-left px-4 py-3 font-medium">Event ID</th>
                <th className="text-left px-4 py-3 font-medium">Статус</th>
                <th className="text-left px-4 py-3 font-medium">Попытки</th>
                <th className="text-left px-4 py-3 font-medium">След. попытка</th>
                <th className="text-left px-4 py-3 font-medium">Ошибка</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {outbox.map((e) => (
                <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(e.createdAt)}</td>
                  <td className="px-4 py-3 font-medium">{e.topic}</td>
                  <td className="px-4 py-3 font-mono text-xs">{e.eventId}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${statusStyles[e.status] ?? "bg-gray-50 text-gray-700"}`}>
                      {e.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">{e.attempts}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(e.nextAttemptAt)}</td>
                  <td className="px-4 py-3 text-xs text-red-600">{trunc(e.lastError || "")}</td>
                  <td className="px-4 py-3">
                    {(e.status === "dead" || e.status === "failed") && <RetryButton id={e.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {outbox.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">Очередь пуста</div>
          )}
        </div>
      </section>

      {/* Integration Log */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Журнал (последние 50 событий)</h2>
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Когда</th>
                <th className="text-left px-4 py-3 font-medium">Направление</th>
                <th className="text-left px-4 py-3 font-medium">Источник</th>
                <th className="text-left px-4 py-3 font-medium">Событие</th>
                <th className="text-left px-4 py-3 font-medium">HTTP</th>
                <th className="text-left px-4 py-3 font-medium">Длит.</th>
                <th className="text-left px-4 py-3 font-medium">Ошибка</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(l.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${directionStyles[l.direction] ?? "bg-gray-50 text-gray-700"}`}>
                      {l.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3">{l.source}</td>
                  <td className="px-4 py-3">{l.event}</td>
                  <td className="px-4 py-3">{l.statusCode ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{l.durationMs ? `${l.durationMs}ms` : "—"}</td>
                  <td className="px-4 py-3 text-xs text-red-600">{trunc(l.error || "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">Журнал пуст</div>
          )}
        </div>
      </section>
    </div>
  )
}
