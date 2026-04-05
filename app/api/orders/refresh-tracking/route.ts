import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { refreshTrackingForOrder } from "@/lib/delivery/shipment"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { orderId } = await request.json()
    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 })
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { userId: true, carrierStatus: true },
    })

    if (!order || order.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    try {
      const statuses = await refreshTrackingForOrder(orderId)
      const updated = await prisma.order.findUnique({
        where: { id: orderId },
        select: { carrierStatus: true },
      })
      return NextResponse.json({
        carrierStatus: updated?.carrierStatus || order.carrierStatus,
        statuses: statuses || [],
      })
    } catch {
      return NextResponse.json({ error: "Не удалось обновить статус" }, { status: 500 })
    }
  } catch (e) {
    console.error("Refresh tracking error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
