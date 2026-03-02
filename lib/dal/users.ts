import { prisma } from "@/lib/prisma"

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: {
      accounts: {
        select: { provider: true, providerAccountId: true },
      },
    },
  })
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
  })
}

export async function getUserByTelegramId(telegramId: string) {
  return prisma.user.findUnique({
    where: { telegramId },
  })
}
