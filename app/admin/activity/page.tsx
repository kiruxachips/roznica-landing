export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-guard"
import { ActivityFeed } from "./ActivityFeed"

const PAGE_SIZE = 100

export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; action?: string; entity?: string }>
}) {
  await requireAdmin("users.view")
  const params = await searchParams

  const where: { adminUserId?: string; action?: { contains: string }; entityType?: string } = {}
  if (params.user) where.adminUserId = params.user
  if (params.action) where.action = { contains: params.action }
  if (params.entity) where.entityType = params.entity

  const [logs, admins] = await Promise.all([
    prisma.adminActivityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
    }),
    prisma.adminUser.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold mb-2">Журнал действий</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Последние {PAGE_SIZE} действий администраторов и менеджеров в панели.
      </p>
      <ActivityFeed
        logs={logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() }))}
        admins={admins}
        initialFilters={{ user: params.user, action: params.action, entity: params.entity }}
      />
    </div>
  )
}
