"use server"

import { createOrder as createOrderDAL, updateOrderStatus as updateOrderStatusDAL } from "@/lib/dal/orders"
import type { OrderData } from "@/lib/types"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"

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
  revalidatePath("/admin/orders")
  revalidatePath(`/admin/orders/${id}`)
}
