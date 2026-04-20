import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { can, type Permission, type AdminRole } from "@/lib/permissions"

export interface AdminContext {
  userId: string
  email: string
  name: string
  role: AdminRole
}

/**
 * Проверяет, что запрос делает админ с требуемым правом.
 * Бросает Error если не авторизован или не хватает прав.
 *
 * Возвращает контекст админа — используется для logAdminAction.
 */
export async function requireAdmin(permission: Permission): Promise<AdminContext> {
  const session = await auth()
  const u = session?.user as
    | { id?: string; userType?: string; role?: string; email?: string; name?: string }
    | undefined

  if (!u?.id || u.userType !== "admin") {
    throw new Error("Нет доступа: требуется вход как администратор")
  }

  const role = (u.role as AdminRole) || "manager"
  if (!can(role, permission)) {
    throw new Error(`Нет доступа: операция "${permission}" недоступна для роли "${role}"`)
  }

  return {
    userId: u.id,
    email: u.email || "",
    name: u.name || "",
    role,
  }
}

/**
 * То же самое, но возвращает null если нет доступа — для UI, где мы не бросаем,
 * а просто скрываем элемент.
 */
export async function checkAdmin(permission: Permission): Promise<AdminContext | null> {
  try {
    return await requireAdmin(permission)
  } catch {
    return null
  }
}

/**
 * Возвращает текущий admin-контекст (или null если пользователь — не admin).
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  const session = await auth()
  const u = session?.user as
    | { id?: string; userType?: string; role?: string; email?: string; name?: string }
    | undefined
  if (!u?.id || u.userType !== "admin") return null
  return {
    userId: u.id,
    email: u.email || "",
    name: u.name || "",
    role: (u.role as AdminRole) || "manager",
  }
}

/**
 * Запись в AdminActivityLog. Не должна блокировать основной поток —
 * ошибки проглатываем и логируем в консоль.
 */
export async function logAdminAction(params: {
  admin: AdminContext | null
  action: string
  entityType?: string
  entityId?: string
  payload?: Record<string, unknown>
}): Promise<void> {
  try {
    await prisma.adminActivityLog.create({
      data: {
        adminUserId: params.admin?.userId ?? null,
        adminName: params.admin?.name ?? null,
        adminRole: params.admin?.role ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        payload: params.payload as object | undefined,
      },
    })
  } catch (e) {
    console.error("[admin-guard] logAdminAction failed:", e)
  }
}
