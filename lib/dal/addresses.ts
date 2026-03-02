import { prisma } from "@/lib/prisma"

export async function getAddressesByUserId(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  })
}

export async function getDefaultAddress(userId: string) {
  return prisma.address.findFirst({
    where: { userId, isDefault: true },
  })
}

export async function getAddressById(id: string) {
  return prisma.address.findUnique({ where: { id } })
}

export async function getAddressCount(userId: string) {
  return prisma.address.count({ where: { userId } })
}
