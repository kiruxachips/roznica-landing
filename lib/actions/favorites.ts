"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function toggleFavorite(productId: string) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: "Необходимо авторизоваться" }
  }

  const userId = session.user.id
  const existing = await prisma.favorite.findUnique({
    where: { userId_productId: { userId, productId } },
  })

  if (existing) {
    await prisma.favorite.delete({
      where: { id: existing.id },
    })
    revalidatePath("/account/favorites")
    return { favorited: false }
  }

  await prisma.favorite.create({
    data: { userId, productId },
  })
  revalidatePath("/account/favorites")
  return { favorited: true }
}
