import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
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

  const updateData: Record<string, unknown> = {}

  if (statusCode) {
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
    // Order accepted by CDEK
    if (order.status === "paid" || order.status === "confirmed") {
      updateData.status = "shipped"
    }
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.order.update({
      where: { id: order.id },
      data: updateData,
    })
  }

  return NextResponse.json({}, { status: 200 })
}
