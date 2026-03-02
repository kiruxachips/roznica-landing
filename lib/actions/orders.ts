"use server"

import { createOrder as createOrderDAL, updateOrderStatus as updateOrderStatusDAL, getOrderById } from "@/lib/dal/orders"
import { creditBonusesForOrder } from "@/lib/dal/bonuses"
import type { OrderData } from "@/lib/types"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { sendOrderStatusEmail } from "@/lib/email"

export async function createOrder(data: OrderData) {
  // Attach userId from session if logged in as customer
  const session = await auth()
  if (session?.user?.id && (session.user as Record<string, unknown>).userType === "customer") {
    data.userId = session.user.id
  }

  const order = await createOrderDAL(data)
  revalidatePath("/admin/orders")
  return { orderNumber: order.orderNumber, id: order.id, thankYouToken: order.thankYouToken }
}

export async function updateOrderStatus(id: string, status: string) {
  await updateOrderStatusDAL(id, status)

  // Send email notification + bonus logic
  try {
    const order = await getOrderById(id)
    if (order?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: order.userId },
        select: { email: true, name: true, notifyOrderStatus: true },
      })

      // Send email if user opted in
      if (user?.email && user.notifyOrderStatus) {
        await sendOrderStatusEmail({
          to: user.email,
          customerName: user.name || "Клиент",
          orderNumber: order.orderNumber,
          newStatus: status,
        })
      }

      // Credit bonuses on delivery
      if (status === "delivered") {
        await creditBonusesForOrder(order.userId, order.id, order.total)
      }
    }
  } catch {
    // Don't fail the status update if email/bonus fails
  }

  revalidatePath("/admin/orders")
  revalidatePath(`/admin/orders/${id}`)
  revalidatePath("/account/orders")
}
