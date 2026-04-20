"use server"

import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

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

  return { success: true }
}
