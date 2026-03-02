import { prisma } from "@/lib/prisma"

export async function getUserNotificationPrefs(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      notifyOrderStatus: true,
      notifyPromotions: true,
      notifyNewProducts: true,
    },
  })
  return user
}
