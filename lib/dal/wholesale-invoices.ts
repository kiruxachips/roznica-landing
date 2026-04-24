import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

/**
 * Сквозная годовая нумерация счетов: INV-YYYY-NNNN.
 * При параллельных вставках unique constraint на number защитит от коллизии,
 * но мы минимизируем вероятность через SELECT MAX в транзакции.
 */
export async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  prefix: "INV" | "UPD" | "ACT" = "INV"
): Promise<string> {
  const year = new Date().getFullYear()
  const like = `${prefix}-${year}-%`
  const last = await tx.wholesaleInvoice.findFirst({
    where: { number: { startsWith: `${prefix}-${year}-` } },
    orderBy: { number: "desc" },
    select: { number: true },
  })
  const lastNum = last ? Number(last.number.split("-")[2]) || 0 : 0
  const next = String(lastNum + 1).padStart(4, "0")
  return `${prefix}-${year}-${next}`
}

export interface InvoiceBuyerSnapshot {
  legalName: string
  inn: string
  kpp: string | null
  legalAddress: string | null
  bankName: string | null
  bankAccount: string | null
  bankBic: string | null
  corrAccount: string | null
}

export interface InvoiceSellerSnapshot {
  legalName: string
  inn: string
  kpp: string | null
  legalAddress: string
  bankName: string
  bankAccount: string
  bankBic: string
  corrAccount: string
}

export interface InvoiceLineItem {
  name: string
  weight: string
  quantity: number
  price: number
  total: number
}

/**
 * Реквизиты продавца (Millor Coffee). Берутся из env чтобы не дублировать
 * в каждой компании. Единственный источник правды — production env.
 */
export function getSellerSnapshot(): InvoiceSellerSnapshot {
  return {
    legalName: process.env.SELLER_LEGAL_NAME || "ИП Дзизенко К.А.",
    inn: process.env.SELLER_INN || "000000000000",
    kpp: process.env.SELLER_KPP || null,
    legalAddress: process.env.SELLER_ADDRESS || "—",
    bankName: process.env.SELLER_BANK_NAME || "—",
    bankAccount: process.env.SELLER_BANK_ACCOUNT || "—",
    bankBic: process.env.SELLER_BANK_BIC || "—",
    corrAccount: process.env.SELLER_CORR_ACCOUNT || "—",
  }
}

export async function listCompanyInvoices(companyId: string, opts?: { take?: number }) {
  return prisma.wholesaleInvoice.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 50,
  })
}

export async function getInvoiceById(id: string) {
  return prisma.wholesaleInvoice.findUnique({ where: { id } })
}

export async function getInvoiceByOrderId(orderId: string) {
  return prisma.wholesaleInvoice.findUnique({ where: { orderId } })
}
