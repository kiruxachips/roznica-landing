export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { requireAdmin } from "@/lib/admin-guard"
import { UsersManager } from "./UsersManager"

export default async function AdminUsersPage() {
  const currentAdmin = await requireAdmin("users.view")

  const users = await prisma.adminUser.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-2">Пользователи админки</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Одобряйте заявки менеджеров, блокируйте доступ, управляйте ролями.
      </p>
      <UsersManager
        users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString(), updatedAt: u.updatedAt.toISOString() }))}
        currentUserId={currentAdmin.userId}
      />
    </div>
  )
}
