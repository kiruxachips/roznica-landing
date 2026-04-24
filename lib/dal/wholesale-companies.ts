import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export type WholesaleCompanyListItem = {
  id: string
  legalName: string
  inn: string
  status: string
  paymentTerms: string
  creditLimit: number
  creditUsed: number
  priceListId: string | null
  priceListName: string | null
  managerAdminId: string | null
  managerName: string | null
  usersCount: number
  ordersCount: number
  createdAt: Date
}

export async function listWholesaleCompanies(filter?: {
  status?: string
  managerAdminId?: string
  search?: string
}): Promise<WholesaleCompanyListItem[]> {
  const where: Prisma.WholesaleCompanyWhereInput = {}
  if (filter?.status && filter.status !== "all") where.status = filter.status
  if (filter?.managerAdminId) where.managerAdminId = filter.managerAdminId
  if (filter?.search) {
    where.OR = [
      { legalName: { contains: filter.search, mode: "insensitive" } },
      { inn: { contains: filter.search } },
      { brandName: { contains: filter.search, mode: "insensitive" } },
    ]
  }

  const rows = await prisma.wholesaleCompany.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      legalName: true,
      inn: true,
      status: true,
      paymentTerms: true,
      creditLimit: true,
      creditUsed: true,
      priceListId: true,
      managerAdminId: true,
      createdAt: true,
      priceList: { select: { name: true } },
      _count: { select: { users: true, orders: true } },
    },
  })

  // Дозагружаем имена менеджеров одним запросом
  const managerIds = Array.from(new Set(rows.map((r) => r.managerAdminId).filter((x): x is string => !!x)))
  const managers = managerIds.length
    ? await prisma.adminUser.findMany({
        where: { id: { in: managerIds } },
        select: { id: true, name: true },
      })
    : []
  const managerMap = new Map(managers.map((m) => [m.id, m.name]))

  return rows.map((r) => ({
    id: r.id,
    legalName: r.legalName,
    inn: r.inn,
    status: r.status,
    paymentTerms: r.paymentTerms,
    creditLimit: r.creditLimit,
    creditUsed: r.creditUsed,
    priceListId: r.priceListId,
    priceListName: r.priceList?.name ?? null,
    managerAdminId: r.managerAdminId,
    managerName: r.managerAdminId ? managerMap.get(r.managerAdminId) ?? null : null,
    usersCount: r._count.users,
    ordersCount: r._count.orders,
    createdAt: r.createdAt,
  }))
}

export async function getWholesaleCompanyById(id: string) {
  return prisma.wholesaleCompany.findUnique({
    where: { id },
    include: {
      priceList: true,
      users: { orderBy: { createdAt: "asc" } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          approvalStatus: true,
          total: true,
          paymentTerms: true,
          createdAt: true,
        },
      },
      creditTx: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      documents: { orderBy: { createdAt: "desc" } },
    },
  })
}
