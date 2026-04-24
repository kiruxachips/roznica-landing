import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export async function getWholesaleOrdersForCompany(companyId: string, opts?: { take?: number }) {
  return prisma.order.findMany({
    where: { channel: "wholesale", wholesaleCompanyId: companyId },
    orderBy: { createdAt: "desc" },
    take: opts?.take ?? 50,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      approvalStatus: true,
      total: true,
      paymentTerms: true,
      paymentStatus: true,
      createdAt: true,
      trackingNumber: true,
      trackingToken: true,
      thankYouToken: true,
      items: {
        select: { id: true, name: true, weight: true, price: true, quantity: true },
      },
    },
  })
}

export async function getWholesaleOrderByIdForCompany(orderId: string, companyId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, channel: "wholesale", wholesaleCompanyId: companyId },
    include: {
      items: true,
      statusLogs: { orderBy: { createdAt: "asc" } },
    },
  })
}

export async function listAdminWholesaleOrders(filter?: {
  status?: string
  approvalStatus?: string
  companyId?: string
  search?: string
}) {
  const where: Prisma.OrderWhereInput = { channel: "wholesale" }
  if (filter?.status && filter.status !== "all") where.status = filter.status
  if (filter?.approvalStatus && filter.approvalStatus !== "all") where.approvalStatus = filter.approvalStatus
  if (filter?.companyId) where.wholesaleCompanyId = filter.companyId
  if (filter?.search) {
    where.OR = [
      { orderNumber: { contains: filter.search, mode: "insensitive" } },
      { b2bLegalName: { contains: filter.search, mode: "insensitive" } },
      { b2bInn: { contains: filter.search } },
      { customerName: { contains: filter.search, mode: "insensitive" } },
    ]
  }

  return prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      approvalStatus: true,
      total: true,
      paymentTerms: true,
      paymentStatus: true,
      createdAt: true,
      b2bLegalName: true,
      b2bInn: true,
      wholesaleCompanyId: true,
      wholesaleCompany: { select: { legalName: true } },
    },
  })
}
