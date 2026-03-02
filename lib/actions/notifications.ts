"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { revalidatePath } from "next/cache"

interface NotificationPrefs {
  notifyOrderStatus: boolean
  notifyPromotions: boolean
  notifyNewProducts: boolean
}

export async function updateNotificationPrefs(prefs: NotificationPrefs) {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: "Необходимо авторизоваться" }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      notifyOrderStatus: prefs.notifyOrderStatus,
      notifyPromotions: prefs.notifyPromotions,
      notifyNewProducts: prefs.notifyNewProducts,
    },
  })

  revalidatePath("/account/notifications")
  return { success: true }
}
