import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { adjustStock, type StockAdjustResult } from "@/lib/dal/stock"
import { refundGiftStock } from "@/lib/dal/gifts"
import { notifyStockChanges } from "@/lib/integrations/stock-alerts"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * I5 (B-3): GET /api/cron/cancel-stale-pending
 *
 * **КРИТИЧНО**: без этого cron'а заказы с paymentStatus="pending"
 * висят вечно — stock декрементирован при createOrder, но никто его
 * не возвращает (webhook YooKassa приходит только при `succeeded` или
 * `canceled`; если юзер просто закрыл вкладку, никакого webhook'а нет).
 *
 * Один абандон == один товар «забран» с витрины навсегда.
 *
 * Запускать каждые 15 минут (тот же планировщик что и
 * abandoned-cart-recovery). Параметры:
 *   - STALE_AFTER_MS: через сколько времени pending считается мёртвым.
 *     По умолчанию 48 часов — даём юзеру шанс «вернуться через сутки и
 *     доплатить» (с PendingPaymentBanner это реально). 24h — тоже норма.
 *
 * Логика идемпотентна: используем updateMany WHERE paymentStatus=pending,
 * count=0 → пропускаем (другой запуск опередил). Stock возвращаем
 * атомарно, как в webhook canceled-ветке.
 *
 * Авторизация: Bearer ${CRON_SECRET}.
 */
const STALE_AFTER_MS = 48 * 60 * 60 * 1000

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - STALE_AFTER_MS)
  const stale = await prisma.order.findMany({
    where: {
      paymentStatus: "pending",
      status: { notIn: ["paid", "cancelled"] },
      createdAt: { lt: cutoff },
      // Не трогаем wholesale: у них pending=approval, не платёжный.
      channel: "retail",
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      bonusUsed: true,
      userId: true,
      selectedGiftId: true,
      items: { select: { variantId: true, quantity: true } },
    },
    take: 100, // батчим, чтобы один прогон не висел вечно при бэклоге
  })

  if (stale.length === 0) {
    return NextResponse.json({ cancelled: 0 })
  }

  let cancelled = 0
  const allStockResults: StockAdjustResult[] = []

  for (const order of stale) {
    try {
      const stockResults: StockAdjustResult[] = []
      await prisma.$transaction(async (tx) => {
        // Compare-and-swap (как в webhook): если кто-то уже отменил между
        // findMany и transaction, count=0 → throw → ловим ниже без эффекта.
        const updated = await tx.order.updateMany({
          where: {
            id: order.id,
            paymentStatus: "pending",
            status: { notIn: ["paid", "cancelled"] },
          },
          data: {
            status: "cancelled",
            paymentStatus: "canceled",
            selectedGiftId: null,
            adminNotes: `[auto-cancel] Pending дольше ${STALE_AFTER_MS / 3600000}h — отменён cron'ом`,
          },
        })
        if (updated.count === 0) {
          throw new Error("RACE_LOST")
        }
        await tx.orderStatusLog.create({
          data: {
            orderId: order.id,
            fromStatus: order.status,
            toStatus: "cancelled",
            changedBy: "cron",
          },
        })
        for (const item of order.items) {
          if (!item.variantId) continue
          const res = await adjustStock(
            {
              variantId: item.variantId,
              delta: +item.quantity,
              reason: "order_cancelled",
              orderId: order.id,
              notes: "Авто-отмена: pending > 48h",
              changedBy: "cron",
            },
            tx
          )
          stockResults.push(res)
        }
        if (order.selectedGiftId) {
          await refundGiftStock(order.selectedGiftId, tx)
        }
      })

      // Возврат бонусов отдельной транзакцией (см. webhook).
      if (order.bonusUsed > 0 && order.userId) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: order.userId },
            data: { bonusBalance: { increment: order.bonusUsed } },
          }),
          prisma.bonusTransaction.create({
            data: {
              userId: order.userId,
              amount: order.bonusUsed,
              type: "admin_adjustment",
              description: `Возврат бонусов — авто-отмена pending заказа ${order.orderNumber}`,
              orderId: order.id,
            },
          }),
        ])
      }

      cancelled++
      allStockResults.push(...stockResults)
    } catch (e) {
      if (e instanceof Error && e.message === "RACE_LOST") {
        // Кто-то уже отменил — это нормально, молча пропускаем.
        continue
      }
      console.error(
        `[cancel-stale-pending] failed for ${order.orderNumber}:`,
        e
      )
    }
  }

  if (allStockResults.length > 0) {
    void notifyStockChanges(allStockResults)
  }

  return NextResponse.json({ cancelled, scanned: stale.length })
}
