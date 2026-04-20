export const dynamic = "force-dynamic"

import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-guard"
import { EmailDispatchTable } from "./EmailDispatchTable"

const PAGE_SIZE = 100

const STATUSES = ["all", "pending", "failed", "sent", "dead"] as const
type StatusFilter = (typeof STATUSES)[number]

export default async function AdminEmailDispatchPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string; q?: string; page?: string }>
}) {
  await requireAdmin("email.view")
  const sp = (await searchParams) ?? {}
  const status = STATUSES.includes(sp.status as StatusFilter) ? (sp.status as StatusFilter) : "all"
  const q = (sp.q ?? "").trim()
  const page = Math.max(1, Number(sp.page) || 1)

  const where: Record<string, unknown> = {}
  if (status !== "all") where.status = status
  if (q) {
    where.OR = [
      { recipient: { contains: q, mode: "insensitive" } },
      { orderId: { contains: q } },
      { kind: { contains: q } },
    ]
  }

  const [rows, total, counts] = await Promise.all([
    prisma.emailDispatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderId: true,
        kind: true,
        recipient: true,
        status: true,
        attempts: true,
        nextAttemptAt: true,
        messageId: true,
        error: true,
        sentAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.emailDispatch.count({ where }),
    prisma.emailDispatch.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const statusCounts = Object.fromEntries(counts.map((c) => [c.status, c._count._all]))

  return (
    <div className="max-w-7xl">
      <h1 className="text-2xl font-bold mb-2">Рассылка писем</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Лог отправок с повторами и идемпотентностью. Snapshot темы и HTML хранится — failed/dead письма
        можно ретраить вручную.
      </p>

      <div className="flex flex-wrap gap-2 mb-4">
        {STATUSES.map((s) => {
          const qs = new URLSearchParams()
          if (s !== "all") qs.set("status", s)
          if (q) qs.set("q", q)
          const active = status === s
          const count = s === "all" ? undefined : statusCounts[s] ?? 0
          const label =
            s === "all" ? "Все" :
            s === "pending" ? "Ожидают" :
            s === "failed" ? "Ошибка" :
            s === "sent" ? "Отправлено" :
            s === "dead" ? "Не отправлено" : s
          return (
            <Link
              key={s}
              href={qs.toString() ? `/admin/email-dispatch?${qs}` : "/admin/email-dispatch"}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white border-border hover:bg-muted"
              }`}
            >
              {label}
              {count !== undefined && <span className="ml-1.5 opacity-70">({count})</span>}
            </Link>
          )
        })}
      </div>

      <form method="get" className="mb-4">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Поиск по email, orderId или типу..."
          className="w-full max-w-md px-3 py-2 border border-border rounded-lg text-sm"
        />
      </form>

      <EmailDispatchTable
        rows={rows.map((r) => ({
          ...r,
          nextAttemptAt: r.nextAttemptAt.toISOString(),
          sentAt: r.sentAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }))}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <p className="text-muted-foreground">
            Всего: <span className="font-medium text-foreground">{total}</span> · Стр. {page} из {totalPages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/email-dispatch?${new URLSearchParams({
                  ...(status !== "all" && { status }),
                  ...(q && { q }),
                  page: String(page - 1),
                }).toString()}`}
                className="px-3 py-1.5 border border-border rounded-lg hover:bg-muted"
              >
                ← Предыдущая
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/email-dispatch?${new URLSearchParams({
                  ...(status !== "all" && { status }),
                  ...(q && { q }),
                  page: String(page + 1),
                }).toString()}`}
                className="px-3 py-1.5 border border-border rounded-lg hover:bg-muted"
              >
                Следующая →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
