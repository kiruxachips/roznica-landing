"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function adminAdjustBonus(
  userId: string,
  amount: number,
  description: string
) {
  if (amount === 0) return { error: "Сумма не может быть 0" }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bonusBalance: true },
  })
  if (!user) return { error: "Пользователь не найден" }

  const newBalance = user.bonusBalance + amount
  if (newBalance < 0) return { error: "Недостаточно бонусов для списания" }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { bonusBalance: newBalance },
    }),
    prisma.bonusTransaction.create({
      data: {
        userId,
        amount,
        type: "admin_adjustment",
        description: description || (amount > 0 ? "Начисление администратором" : "Списание администратором"),
      },
    }),
  ])

  revalidatePath(`/admin/orders`)
  return { success: true, newBalance }
}
