"use server"

import crypto from "crypto"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"
import {
  getSellerSnapshot,
  nextInvoiceNumber,
  type InvoiceBuyerSnapshot,
  type InvoiceLineItem,
} from "@/lib/dal/wholesale-invoices"
import { renderAndSavePDF } from "@/lib/pdf/save-pdf"
import { InvoicePDF } from "@/lib/pdf/invoice-template"
import type { Prisma } from "@prisma/client"

export async function generateInvoiceForOrder(
  orderId: string,
  opts?: { kind?: "invoice" | "upd" | "act"; vatRate?: number | null }
) {
  const admin = await requireAdmin("wholesale.orders.updateStatus")
  const kind = opts?.kind ?? "invoice"

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      wholesaleCompany: true,
    },
  })
  if (!order) throw new Error("Заказ не найден")
  if (order.channel !== "wholesale" || !order.wholesaleCompany) {
    throw new Error("Счёт можно сгенерировать только для оптового заказа")
  }

  // Не перегенерируем если уже есть — возвращаем существующий
  const existing = await prisma.wholesaleInvoice.findUnique({ where: { orderId } })
  if (existing && existing.pdfUrl) return existing

  const buyer: InvoiceBuyerSnapshot = {
    legalName: order.wholesaleCompany.legalName,
    inn: order.wholesaleCompany.inn,
    kpp: order.wholesaleCompany.kpp,
    legalAddress: order.wholesaleCompany.legalAddress,
    bankName: order.wholesaleCompany.bankName,
    bankAccount: order.wholesaleCompany.bankAccount,
    bankBic: order.wholesaleCompany.bankBic,
    corrAccount: order.wholesaleCompany.corrAccount,
  }
  const seller = getSellerSnapshot()

  const items: InvoiceLineItem[] = order.items.map((it) => ({
    name: it.name,
    weight: it.weight,
    quantity: it.quantity,
    price: it.price,
    total: it.price * it.quantity,
  }))

  const vatRate = opts?.vatRate ?? null
  const vatAmount = vatRate !== null
    ? Math.round((order.total * vatRate) / (100 + vatRate))
    : null

  // Транзакция: получить следующий номер + создать WholesaleInvoice запись
  const invoice = await prisma.$transaction(async (tx) => {
    const number = await nextInvoiceNumber(
      tx,
      kind === "invoice" ? "INV" : kind === "upd" ? "UPD" : "ACT"
    )
    return tx.wholesaleInvoice.create({
      data: {
        number,
        kind,
        orderId,
        companyId: order.wholesaleCompanyId!,
        subtotal: order.subtotal,
        discount: order.discount,
        total: order.total,
        vatRate,
        vatAmount,
        buyerSnapshot: buyer as unknown as Prisma.InputJsonValue,
        sellerSnapshot: seller as unknown as Prisma.InputJsonValue,
        itemsSnapshot: items as unknown as Prisma.InputJsonValue,
        status: "draft",
        generatedById: admin.userId,
      },
    })
  })

  // Unguessable filename: number + random 32-hex suffix — защита от IDOR-скачивания
  // чужих счетов по предсказуемым URL (злоумышленник не угадает 256-бит token).
  const secretSuffix = crypto.randomBytes(16).toString("hex")
  const filename = `${invoice.number}-${secretSuffix}.pdf`

  // Render PDF после commit — тяжёлая операция, не держим транзакцию
  const stampUrl = process.env.SELLER_STAMP_URL || null
  const { url, size } = await renderAndSavePDF(
    InvoicePDF({
      kind,
      number: invoice.number,
      date: invoice.createdAt,
      orderNumber: order.orderNumber,
      buyer,
      seller,
      items,
      delivery: {
        carrier: order.deliveryMethod ?? null,
        type: order.deliveryType ?? null,
        address: order.deliveryAddress ?? null,
        price: order.deliveryPrice,
      },
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      vatRate,
      vatAmount,
      paymentTerms: order.paymentTerms,
      stampUrl,
    }),
    `wholesale/invoices/${order.wholesaleCompanyId}`,
    filename
  )

  // Обновляем запись с URL PDF + регистрируем в WholesaleDocument для admin-UI
  const updated = await prisma.$transaction(async (tx) => {
    const upd = await tx.wholesaleInvoice.update({
      where: { id: invoice.id },
      data: { pdfUrl: url },
    })
    await tx.wholesaleDocument.create({
      data: {
        companyId: order.wholesaleCompanyId!,
        kind,
        orderId,
        fileUrl: url,
        fileName: `${invoice.number}.pdf`, // user-facing name без секретного суффикса
        fileSize: size,
        uploadedById: admin.userId,
      },
    })
    return upd
  })

  void logAdminAction({
    admin,
    action: "wholesale.invoice.generated",
    entityType: "wholesale_invoice",
    entityId: invoice.id,
    payload: { number: invoice.number, kind, orderId, total: order.total },
  })

  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/admin/wholesale/companies/${order.wholesaleCompanyId}`)
  return updated
}
