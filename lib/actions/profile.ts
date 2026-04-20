"use server"

import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function updateProfile({
  name,
  phone,
  defaultAddress,
  email,
}: {
  name?: string
  phone?: string
  defaultAddress?: string
  email?: string
}) {
  const session = await auth()
  if (!session?.user?.id || (session.user as Record<string, unknown>).userType !== "customer") {
    return { error: "Не авторизован" }
  }

  // Email is only set here when user didn't have one (from OAuth without email scope).
  // Validate format + uniqueness before saving.
  const updates: Record<string, string | Date> = {}
  if (email !== undefined && email !== "") {
    const emailLower = email.toLowerCase().trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailLower)) {
      return { error: "Некорректный email" }
    }
    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    })
    if (current?.email) {
      return { error: "Email уже установлен, изменить нельзя" }
    }
    const conflict = await prisma.user.findUnique({
      where: { email: emailLower },
      select: { id: true },
    })
    if (conflict && conflict.id !== session.user.id) {
      return { error: "Этот email уже используется другим аккаунтом" }
    }
    updates.email = emailLower
    updates.emailVerified = new Date()
  }
  if (name !== undefined) updates.name = name
  if (phone !== undefined) updates.phone = phone
  if (defaultAddress !== undefined) updates.defaultAddress = defaultAddress

  if (Object.keys(updates).length > 0) {
    await prisma.user.update({ where: { id: session.user.id }, data: updates })
  }

  return { success: true }
}

export async function changePassword({
  currentPassword,
  newPassword,
}: {
  currentPassword?: string
  newPassword: string
}) {
  const session = await auth()
  if (!session?.user?.id || (session.user as Record<string, unknown>).userType !== "customer") {
    return { error: "Не авторизован" }
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user) return { error: "Пользователь не найден" }

  // If user has a password, require current password
  if (user.passwordHash && currentPassword) {
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValid) return { error: "Неверный текущий пароль" }
  } else if (user.passwordHash && !currentPassword) {
    return { error: "Введите текущий пароль" }
  }

  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  return { success: true }
}
