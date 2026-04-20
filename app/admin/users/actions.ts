"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"

export async function approveUser(userId: string) {
  const admin = await requireAdmin("users.approve")
  const target = await prisma.adminUser.update({
    where: { id: userId },
    data: { status: "active" },
  })
  void logAdminAction({
    admin,
    action: "user.approved",
    entityType: "admin_user",
    entityId: userId,
    payload: { email: target.email, role: target.role },
  })
  revalidatePath("/admin/users")
}

export async function blockUser(userId: string) {
  const admin = await requireAdmin("users.block")
  if (userId === admin.userId) {
    throw new Error("Нельзя заблокировать самого себя")
  }
  const target = await prisma.adminUser.update({
    where: { id: userId },
    data: { status: "blocked" },
  })
  void logAdminAction({
    admin,
    action: "user.blocked",
    entityType: "admin_user",
    entityId: userId,
    payload: { email: target.email },
  })
  revalidatePath("/admin/users")
}

export async function unblockUser(userId: string) {
  const admin = await requireAdmin("users.block")
  const target = await prisma.adminUser.update({
    where: { id: userId },
    data: { status: "active" },
  })
  void logAdminAction({
    admin,
    action: "user.unblocked",
    entityType: "admin_user",
    entityId: userId,
    payload: { email: target.email },
  })
  revalidatePath("/admin/users")
}

export async function changeUserRole(userId: string, role: "admin" | "manager") {
  const admin = await requireAdmin("users.approve")
  if (userId === admin.userId) {
    throw new Error("Нельзя менять роль самому себе")
  }
  const target = await prisma.adminUser.update({
    where: { id: userId },
    data: { role },
  })
  void logAdminAction({
    admin,
    action: "user.role_changed",
    entityType: "admin_user",
    entityId: userId,
    payload: { email: target.email, newRole: role },
  })
  revalidatePath("/admin/users")
}

export async function deleteUser(userId: string) {
  const admin = await requireAdmin("users.delete")
  if (userId === admin.userId) {
    throw new Error("Нельзя удалить самого себя")
  }
  const snapshot = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { email: true, name: true, role: true },
  })
  await prisma.adminUser.delete({ where: { id: userId } })
  void logAdminAction({
    admin,
    action: "user.deleted",
    entityType: "admin_user",
    entityId: userId,
    payload: snapshot || undefined,
  })
  revalidatePath("/admin/users")
}

export async function rejectPendingUser(userId: string) {
  const admin = await requireAdmin("users.approve")
  const target = await prisma.adminUser.findUnique({
    where: { id: userId },
    select: { status: true, email: true },
  })
  if (!target) throw new Error("Пользователь не найден")
  if (target.status !== "pending") throw new Error("Можно отклонить только заявку в статусе pending")
  await prisma.adminUser.delete({ where: { id: userId } })
  void logAdminAction({
    admin,
    action: "user.rejected",
    entityType: "admin_user",
    entityId: userId,
    payload: { email: target.email },
  })
  revalidatePath("/admin/users")
}
