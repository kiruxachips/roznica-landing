import { prisma } from "@/lib/prisma"
import { enqueueOutbox } from "@/lib/dal/outbox"
import type { StockAdjustResult } from "@/lib/dal/stock"
import { buildStockPayload } from "@/lib/integrations/millorbot/payload"

/**
 * Отправляет уведомления в millorbot о критичных переходах остатка:
 * - товар стал закончился (becameDepleted)
 * - товар опустился до/ниже порога lowStockThreshold (crossedLowThreshold)
 *
 * Вызывается ПОСЛЕ commit транзакции, чтобы не отправить событие при откате.
 * Единичная ошибка в enqueueOutbox не блокирует основной поток —
 * логируется и проглатывается.
 *
 * Идемпотентность через eventId на основе (variantId, переход stockBefore→stockAfter).
 */
export async function notifyStockChange(result: StockAdjustResult): Promise<void> {
  if (!result.becameDepleted && !result.crossedLowThreshold) return

  try {
    // Подтягиваем карточку варианта для payload (единожды, даже если оба события)
    const variant = await prisma.productVariant.findUnique({
      where: { id: result.variantId },
      include: { product: true },
    })
    if (!variant) return

    if (result.becameDepleted) {
      const eventId = `stock_depleted_${result.variantId}_${result.stockBefore}_to_0`
      const payload = buildStockPayload("product.stock.depleted", {
        variant,
        stockBefore: result.stockBefore,
        stockAfter: result.stockAfter,
        eventId,
      })
      try {
        await enqueueOutbox(
          "product.stock.depleted",
          payload as unknown as Parameters<typeof enqueueOutbox>[1],
          { eventId }
        )
      } catch (e) {
        // P2002 (UNIQUE violation на eventId) — событие уже в очереди, нормально
        if (!(e instanceof Error && e.message.includes("P2002"))) {
          console.error("[stock-alerts] failed to enqueue depleted event:", e)
        }
      }
    }

    // crossedLowThreshold без becameDepleted — отдельное событие
    if (result.crossedLowThreshold && !result.becameDepleted) {
      const eventId = `stock_low_${result.variantId}_${result.stockBefore}_to_${result.stockAfter}`
      const payload = buildStockPayload("product.stock.low", {
        variant,
        stockBefore: result.stockBefore,
        stockAfter: result.stockAfter,
        eventId,
      })
      try {
        await enqueueOutbox(
          "product.stock.low",
          payload as unknown as Parameters<typeof enqueueOutbox>[1],
          { eventId }
        )
      } catch (e) {
        if (!(e instanceof Error && e.message.includes("P2002"))) {
          console.error("[stock-alerts] failed to enqueue low event:", e)
        }
      }
    }
  } catch (e) {
    console.error("[stock-alerts] notifyStockChange failed:", e)
  }
}

/** Удобный helper для вызова по списку результатов. */
export async function notifyStockChanges(results: StockAdjustResult[]): Promise<void> {
  await Promise.all(results.map((r) => notifyStockChange(r)))
}
