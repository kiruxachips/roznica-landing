import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { refreshTrackingForOrder } from "@/lib/delivery/shipment"

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret")
  const expectedSecret = process.env.TRACKING_POLL_SECRET

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const orders = await prisma.order.findMany({
    where: {
      deliveryMethod: "pochta",
      trackingNumber: { not: null },
      status: { notIn: ["delivered", "cancelled"] },
    },
    select: { id: true },
    take: 20,
    orderBy: { updatedAt: "asc" },
  })

  let updated = 0
  let errors = 0

  for (const order of orders) {
    try {
      const statuses = await refreshTrackingForOrder(order.id)
      if (statuses && statuses.length > 0) updated++
    } catch {
      errors++
    }
  }

  return NextResponse.json({
    processed: orders.length,
    updated,
    errors,
  })
}
