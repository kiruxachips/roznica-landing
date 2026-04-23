import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { creditBonusesForOrderInTx, getBonusRateValue } from "@/lib/dal/bonuses"

const SOURCE = "cdek" as const
const MAX_TIMESTAMP_SKEW_MS = 15 * 60 * 1000 // 15 минут

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

  // Timestamp skew check — отклоняем события старше MAX_TIMESTAMP_SKEW_MS.
  // Защита от replay старых захваченных webhook'ов. Если СДЭК не прислал
  // status_date_time — пропускаем проверку (old/new API могут отличаться).
  const statusDateTime = body.attributes?.status_date_time
  if (statusDateTime) {
    const eventTime = Date.parse(statusDateTime)
    if (!Number.isNaN(eventTime)) {
      const skew = Date.now() - eventTime
      if (skew > MAX_TIMESTAMP_SKEW_MS) {
        console.warn(
          `[cdek-webhook] rejecting stale event, skew=${Math.round(skew / 1000)}s for uuid=${carrierOrderId}`
        )
        return NextResponse.json({ error: "Event too old" }, { status: 400 })
      }
      if (skew < -MAX_TIMESTAMP_SKEW_MS) {
        // Clock skew или spoofed future timestamp
        console.warn(
          `[cdek-webhook] rejecting future-dated event, skew=${Math.round(skew / 1000)}s`
        )
        return NextResponse.json({ error: "Event timestamp in future" }, { status: 400 })
      }
    }
  }

  // Idempotency: композитный ключ uuid + status_code + status_date_time.
  // CDEK шлёт несколько событий на один uuid (разные статусы), но одно
  // конкретное событие (uuid+status+time) должно обрабатываться ровно раз.
  const eventId = [
    carrierOrderId,
    body.attributes?.status_code || "_",
    statusDateTime || "_",
  ].join(":")

  const order = await prisma.order.findFirst({
    where: { carrierOrderId },
  })

  if (!order) {
    console.warn(`CDEK webhook: order not found for carrierOrderId ${carrierOrderId}`)
    // Записываем как обработанный, чтобы повтор не флудил логи
    await prisma.processedInboundEvent.create({
      data: { source: SOURCE, eventId },
    }).catch(() => { /* race-insert ok, unique constraint защитит */ })
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

  // Атомарно:
  //   1) processedInboundEvent.create — ПЕРВОЙ операцией в tx. Это страхует
  //      от TOCTOU-гонки: параллельный webhook с тем же eventId получит P2002
  //      на unique-constraint, вся транзакция откатится, update не выполнится
  //      дважды.
  //   2) order.update + statusLog
  //   3) creditBonusesForOrderInTx — в той же транзакции, чтобы не было
  //      сценария «delivered записали, bonus не записали» при падении
  //      процесса между коммитом и внешним вызовом.
  const bonusRate =
    updateData.status === "delivered" && updateData.status !== order.status && order.userId
      ? await getBonusRateValue()
      : null

  if (Object.keys(updateData).length > 0) {
    try {
      await prisma.$transaction(async (tx) => {
        // Idempotency marker ПЕРВОЙ операцией — P2002 откатит всю tx.
        await tx.processedInboundEvent.create({
          data: { source: SOURCE, eventId },
        })

        await tx.order.update({
          where: { id: order.id },
          data: updateData,
        })

        if (updateData.status && updateData.status !== order.status) {
          await tx.orderStatusLog.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: updateData.status as string,
              changedBy: "cdek-webhook",
            },
          })
        }

        // Bonus credit в той же транзакции — атомарность delivered + earned.
        if (bonusRate !== null && order.userId) {
          await creditBonusesForOrderInTx(tx, order.userId, order.id, order.total, bonusRate)
        }
      })
    } catch (err) {
      const e = err as { code?: string }
      if (e?.code === "P2002") {
        // Параллельный webhook уже обработал — idempotent duplicate.
        return NextResponse.json({ status: "duplicate" }, { status: 200 })
      }
      throw err
    }
  } else {
    // Update-полей нет, но событие мы обработали — записываем idempotency-маркер.
    await prisma.processedInboundEvent.create({
      data: { source: SOURCE, eventId },
    }).catch(() => { /* concurrent insert ok */ })
  }

  return NextResponse.json({}, { status: 200 })
}
