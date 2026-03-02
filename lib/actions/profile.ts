"use server"

import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"

export async function updateProfile({
  name,
  phone,
  defaultAddress,
}: {
  name?: string
  phone?: string
  defaultAddress?: string
}) {
  const session = await auth()
  if (!session?.user?.id || (session.user as Record<string, unknown>).userType !== "customer") {
    return { error: "Не авторизован" }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(defaultAddress !== undefined && { defaultAddress }),
    },
  })

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
