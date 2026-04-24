"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { prisma } from "@/lib/prisma"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"
import { CACHE_TAGS } from "@/lib/cache-tags"
import { revalidateTag } from "next/cache"

export async function updateWholesaleCompany(
  id: string,
  patch: {
    legalName?: string
    brandName?: string | null
    kpp?: string | null
    ogrn?: string | null
    legalAddress?: string | null
    postalAddress?: string | null
    bankName?: string | null
    bankBic?: string | null
    bankAccount?: string | null
    corrAccount?: string | null
    contactName?: string | null
    contactPhone?: string | null
    contactEmail?: string | null
    paymentTerms?: string
    creditLimit?: number
    priceListId?: string | null
    managerAdminId?: string | null
    notes?: string | null
  }
) {
  const admin = await requireAdmin("wholesale.companies.edit")

  const existing = await prisma.wholesaleCompany.findUnique({ where: { id } })
  if (!existing) throw new Error("Компания не найдена")

  const updated = await prisma.wholesaleCompany.update({
    where: { id },
    data: patch,
  })

  void logAdminAction({
    admin,
    action: "wholesale.company.updated",
    entityType: "wholesale_company",
    entityId: id,
    payload: {
      before: {
        priceListId: existing.priceListId,
        paymentTerms: existing.paymentTerms,
        creditLimit: existing.creditLimit,
        managerAdminId: existing.managerAdminId,
      },
      after: patch,
    },
  })

  // Если изменился прайс-лист — инвалидируем оптовый каталог компании
  if (patch.priceListId !== undefined && patch.priceListId !== existing.priceListId) {
    if (existing.priceListId) {
      revalidateTag(CACHE_TAGS.wholesaleCatalog(existing.priceListId))
    }
    if (patch.priceListId) {
      revalidateTag(CACHE_TAGS.wholesaleCatalog(patch.priceListId))
    }
    revalidateTag(CACHE_TAGS.wholesaleCompany(id))
  }

  revalidatePath(`/admin/wholesale/companies/${id}`)
  revalidatePath("/admin/wholesale/companies")
  return updated
}

export async function setWholesaleCompanyStatus(id: string, status: "active" | "suspended" | "rejected", reason?: string) {
  const admin = await requireAdmin(status === "rejected" ? "wholesale.companies.delete" : "wholesale.companies.edit")

  const existing = await prisma.wholesaleCompany.findUnique({ where: { id } })
  if (!existing) throw new Error("Компания не найдена")

  const updated = await prisma.wholesaleCompany.update({
    where: { id },
    data: { status },
  })

  void logAdminAction({
    admin,
    action: "wholesale.company.status_changed",
    entityType: "wholesale_company",
    entityId: id,
    payload: { from: existing.status, to: status, reason },
  })

  revalidatePath(`/admin/wholesale/companies/${id}`)
  revalidatePath("/admin/wholesale/companies")
  revalidateTag(CACHE_TAGS.wholesaleCompany(id))
  return updated
}

export async function resetWholesaleUserPassword(userId: string) {
  const admin = await requireAdmin("wholesale.companies.edit")

  const user = await prisma.wholesaleUser.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, companyId: true },
  })
  if (!user) throw new Error("Пользователь не найден")

  // Генерим временный пароль — админ сообщит его клиенту вне системы.
  // Отдельный email-with-reset-link flow — Фаза 5.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  const tempPassword = Array.from({ length: 12 })
    .map(() => alphabet[Math.floor(Math.random() * alphabet.length)])
    .join("")
  const passwordHash = await bcrypt.hash(tempPassword, 10)

  await prisma.wholesaleUser.update({
    where: { id: userId },
    data: { passwordHash },
  })

  void logAdminAction({
    admin,
    action: "wholesale.user.password_reset",
    entityType: "wholesale_user",
    entityId: userId,
    payload: { email: user.email },
  })

  revalidatePath(`/admin/wholesale/companies/${user.companyId}`)
  return { tempPassword }
}

export async function adjustCreditLimit(companyId: string, newLimit: number, reason: string) {
  const admin = await requireAdmin("wholesale.credit.adjust")

  if (newLimit < 0) throw new Error("Кредитный лимит не может быть отрицательным")

  const existing = await prisma.wholesaleCompany.findUnique({ where: { id: companyId } })
  if (!existing) throw new Error("Компания не найдена")

  await prisma.wholesaleCompany.update({
    where: { id: companyId },
    data: { creditLimit: newLimit },
  })

  void logAdminAction({
    admin,
    action: "wholesale.credit.limit_changed",
    entityType: "wholesale_company",
    entityId: companyId,
    payload: { from: existing.creditLimit, to: newLimit, reason },
  })

  revalidatePath(`/admin/wholesale/companies/${companyId}`)
  revalidatePath("/admin/wholesale/credit")
  return { creditLimit: newLimit }
}

export async function recordCreditPayment(input: {
  companyId: string
  amount: number
  description: string
  orderId?: string | null
}) {
  const admin = await requireAdmin("wholesale.credit.adjust")

  if (input.amount <= 0) throw new Error("Сумма должна быть больше нуля")

  const existing = await prisma.wholesaleCompany.findUnique({ where: { id: input.companyId } })
  if (!existing) throw new Error("Компания не найдена")

  const idempotencyKey = `credit:payment:${input.companyId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`

  await prisma.$transaction(async (tx) => {
    await tx.wholesaleCreditTransaction.create({
      data: {
        companyId: input.companyId,
        amount: -input.amount, // отрицательное — долг уменьшается
        type: "payment_received",
        orderId: input.orderId ?? null,
        description: input.description,
        idempotencyKey,
        createdBy: admin.userId,
      },
    })
    await tx.wholesaleCompany.update({
      where: { id: input.companyId },
      data: { creditUsed: { decrement: input.amount } },
    })
  })

  void logAdminAction({
    admin,
    action: "wholesale.credit.payment_received",
    entityType: "wholesale_company",
    entityId: input.companyId,
    payload: { amount: input.amount, description: input.description, orderId: input.orderId },
  })

  revalidatePath(`/admin/wholesale/companies/${input.companyId}`)
  revalidatePath("/admin/wholesale/credit")
  return { ok: true }
}
