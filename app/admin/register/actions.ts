"use server"

import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { after } from "next/server"
import {
  renderAdminPendingRegistrationEmail,
  sendRenderedEmail,
  getAdminNotificationEmails,
} from "@/lib/email"
import { dispatchEmail } from "@/lib/dal/email-dispatch"

/**
 * Публичное действие — регистрация нового менеджера.
 * Создаёт AdminUser с role=manager, status=pending.
 * Админ одобряет вход в /admin/users.
 */
export async function registerManagerAction(input: {
  email: string
  name: string
  password: string
}): Promise<{ success: boolean; error?: string }> {
  const email = input.email.toLowerCase().trim()
  const name = input.name.trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { success: false, error: "Некорректный email" }
  }
  if (name.length < 2) {
    return { success: false, error: "Укажите имя" }
  }
  if (input.password.length < 8) {
    return { success: false, error: "Пароль должен быть не короче 8 символов" }
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } })
  if (existing) {
    // Не раскрываем наличие аккаунта — даём расплывчатое сообщение
    return { success: false, error: "Невозможно создать учётную запись с этим email" }
  }

  const passwordHash = await bcrypt.hash(input.password, 10)
  await prisma.adminUser.create({
    data: {
      email,
      name,
      passwordHash,
      role: "manager",
      status: "pending",
    },
  })

  // N-2: уведомление суперадминам о pending-менеджере, чтобы они могли
  // одобрить сразу, а не ждать пока кто-то случайно зайдёт в /admin/users.
  // Через EmailDispatch — durability + idempotency (дубли по email невозможны
  // благодаря AdminUser.email unique-constraint выше).
  const adminEmails = getAdminNotificationEmails()
  after(async () => {
    for (const admin of adminEmails) {
      await dispatchEmail({
        orderId: null,
        kind: `admin.pending_manager:${email}` as const,
        recipient: admin,
        render: () =>
          renderAdminPendingRegistrationEmail({
            managerName: name,
            managerEmail: email,
          }),
        send: sendRenderedEmail,
      }).catch((e) =>
        console.error("[register-manager] admin email dispatch failed:", e)
      )
    }
  })

  return { success: true }
}
