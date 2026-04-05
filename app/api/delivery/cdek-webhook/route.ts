import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.CDEK_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("CDEK_WEBHOOK_SECRET not configured — rejecting all webhooks")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }
  const url = new URL(request.url)
  const secret = url.searchParams.get("secret")
  if (secret !== webhookSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: {
    type: string
    uuid: string
    attributes?: {
      is_return?: boolean
      cdek_number?: string
      code?: string
      status_code?: string
      status_date_time?: string
    }
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  // CDEK sends ORDER_STATUS events
  if (body.type !== "ORDER_STATUS") {
    return NextResponse.json({}, { status: 200 })
  }

  const carrierOrderId = body.uuid
  if (!carrierOrderId) {
    return NextResponse.json({}, { status: 200 })
  }

  const order = await prisma.order.findFirst({
    where: { carrierOrderId },
  })

  if (!order) {
    console.warn(`CDEK webhook: order not found for carrierOrderId ${carrierOrderId}`)
    return NextResponse.json({}, { status: 200 })
  }

  const statusCode = body.attributes?.status_code
  const cdekNumber = body.attributes?.cdek_number

  // Only process known CDEK status codes
  const KNOWN_STATUSES = [
    "CREATED", "RECEIVED_AT_SHIPMENT_WAREHOUSE", "READY_FOR_SHIPMENT_IN_TRANSIT_CITY",
    "ACCEPTED", "IN_TRANSIT", "ARRIVED_AT_RECIPIENT_CITY",
    "ACCEPTED_AT_PICK_UP_POINT", "TAKEN_BY_COURIER", "DELIVERED",
    "NOT_DELIVERED", "RETURNED", "SEIZED",
  ]

  const updateData: Record<string, unknown> = {}

  if (statusCode && KNOWN_STATUSES.includes(statusCode)) {
    updateData.carrierStatus = statusCode
  }

  if (cdekNumber && !order.trackingNumber) {
    updateData.trackingNumber = cdekNumber
    updateData.carrierOrderNum = cdekNumber
  }

  // Map CDEK statuses to our order statuses
  if (statusCode === "DELIVERED") {
    updateData.status = "delivered"
  } else if (statusCode === "ACCEPTED" || statusCode === "CREATED") {
    if (order.status === "paid" || order.status === "confirmed") {
      updateData.status = "shipped"
    }
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.order.update({
      where: { id: order.id },
      data: updateData,
    })

    // Log status change for audit trail
    if (updateData.status && updateData.status !== order.status) {
      await prisma.orderStatusLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: updateData.status as string,
          changedBy: "cdek-webhook",
        },
      })
    }
  }

  return NextResponse.json({}, { status: 200 })
}
