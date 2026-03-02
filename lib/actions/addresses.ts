"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

interface AddressData {
  title: string
  fullAddress: string
  recipientName?: string
  recipientPhone?: string
  isDefault?: boolean
}

export async function createAddress(data: AddressData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Необходимо авторизоваться" }

  const userId = session.user.id
  const count = await prisma.address.count({ where: { userId } })
  if (count >= 5) return { error: "Максимум 5 адресов" }

  await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    // First address is always default
    const makeDefault = data.isDefault || count === 0

    await tx.address.create({
      data: {
        userId,
        title: data.title,
        fullAddress: data.fullAddress,
        recipientName: data.recipientName || null,
        recipientPhone: data.recipientPhone || null,
        isDefault: makeDefault,
      },
    })
  })

  revalidatePath("/account/addresses")
  return { success: true }
}

export async function updateAddress(id: string, data: AddressData) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Необходимо авторизоваться" }

  const userId = session.user.id
  const address = await prisma.address.findUnique({ where: { id } })
  if (!address || address.userId !== userId) return { error: "Адрес не найден" }

  await prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      })
    }

    await tx.address.update({
      where: { id },
      data: {
        title: data.title,
        fullAddress: data.fullAddress,
        recipientName: data.recipientName || null,
        recipientPhone: data.recipientPhone || null,
        isDefault: data.isDefault ?? address.isDefault,
      },
    })
  })

  revalidatePath("/account/addresses")
  return { success: true }
}

export async function deleteAddress(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Необходимо авторизоваться" }

  const address = await prisma.address.findUnique({ where: { id } })
  if (!address || address.userId !== session.user.id) return { error: "Адрес не найден" }

  await prisma.address.delete({ where: { id } })

  // If deleted was default, make the first remaining address default
  if (address.isDefault) {
    const first = await prisma.address.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    })
    if (first) {
      await prisma.address.update({
        where: { id: first.id },
        data: { isDefault: true },
      })
    }
  }

  revalidatePath("/account/addresses")
  return { success: true }
}

export async function setDefaultAddress(id: string) {
  const session = await auth()
  if (!session?.user?.id) return { error: "Необходимо авторизоваться" }

  const userId = session.user.id
  const address = await prisma.address.findUnique({ where: { id } })
  if (!address || address.userId !== userId) return { error: "Адрес не найден" }

  await prisma.$transaction([
    prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.address.update({
      where: { id },
      data: { isDefault: true },
    }),
  ])

  revalidatePath("/account/addresses")
  return { success: true }
}
