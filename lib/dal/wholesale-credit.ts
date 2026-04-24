import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

/**
 * Кредитный ledger: все изменения creditUsed проходят через эту функцию.
 * Используется в транзакции создания/отмены заказа — защита от двойного списания
 * через idempotencyKey (orderId:type).
 */
export async function recordCreditTransaction(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string
    amount: number
    type: "order_placed" | "order_cancelled" | "payment_received" | "adjustment"
    orderId?: string | null
    description?: string | null
    idempotencyKey: string
    createdBy?: string | null
  }
) {
  // Идемпотентность — если запись с таким ключом есть, не повторяем.
  try {
    const created = await tx.wholesaleCreditTransaction.create({
      data: {
        companyId: input.companyId,
        amount: input.amount,
        type: input.type,
        orderId: input.orderId ?? null,
        description: input.description ?? null,
        idempotencyKey: input.idempotencyKey,
        createdBy: input.createdBy ?? null,
      },
    })
    await tx.wholesaleCompany.update({
      where: { id: input.companyId },
      data: { creditUsed: { increment: input.amount } },
    })
    return created
  } catch (e) {
    // P2002 — запись с таким ключом уже есть. Повторно не применяем.
    const err = e as { code?: string }
    if (err.code === "P2002") return null
    throw e
  }
}

export async function getCreditHistory(companyId: string, opts?: { take?: number }) {
  return prisma.wholesaleCreditTransaction.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 50,
  })
}
