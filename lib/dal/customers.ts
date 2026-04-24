import { prisma } from "@/lib/prisma"

/**
 * Admin Customers DAL.
 *
 * Важно: здесь используется прямой доступ к User (тип = customer, не admin).
 * Фильтруем `deletedAt: null` по умолчанию — удалённые видны только через
 * отдельный флаг includeDeleted=true (для compliance-аудита).
 */

export interface CustomerRow {
  id: string
  email: string | null
  name: string | null
  phone: string | null
  createdAt: Date
  emailVerified: Date | null
  firstOrderCompletedAt: Date | null
  bonusBalance: number
  totalSpent: number
  ordersCount: number
  lastOrderAt: Date | null
  deletedAt: Date | null
}

interface ListFilters {
  search?: string // email / phone / name
  status?: "all" | "active" | "new" | "repeat" | "deleted"
  page?: number
  limit?: number
}

export async function getCustomers(
  filters: ListFilters = {}
): Promise<{ customers: CustomerRow[]; total: number }> {
  const { search, status = "all", page = 1, limit = 30 } = filters
  const where: Record<string, unknown> = {}
  if (status !== "deleted") where.deletedAt = null
  if (status === "deleted") where.deletedAt = { not: null }

  if (search?.trim()) {
    const q = search.trim()
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ]
  }

  if (status === "new") where.firstOrderCompletedAt = null
  if (status === "repeat") {
    // Повторный клиент — сделал >= 2 заказа. Фильтруем на уровне aggregate.
    // Prisma WHERE этого не умеет красиво, поэтому делаем _count-фильтр через
    // RAW не нужен — сортируем + фильтр в JS после findMany. Для масштаба
    // добавим HAVING, но пока limit=30/страницу и проще.
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        createdAt: true,
        emailVerified: true,
        firstOrderCompletedAt: true,
        bonusBalance: true,
        deletedAt: true,
        orders: {
          select: { id: true, total: true, createdAt: true, status: true },
          where: { status: { in: ["paid", "confirmed", "shipped", "delivered"] } },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  const customers: CustomerRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    createdAt: u.createdAt,
    emailVerified: u.emailVerified,
    firstOrderCompletedAt: u.firstOrderCompletedAt,
    bonusBalance: u.bonusBalance,
    totalSpent: u.orders.reduce((s, o) => s + o.total, 0),
    ordersCount: u.orders.length,
    lastOrderAt: u.orders[0]?.createdAt ?? null,
    deletedAt: u.deletedAt,
  }))

  return {
    customers:
      status === "repeat" ? customers.filter((c) => c.ordersCount >= 2) : customers,
    total,
  }
}

export async function getCustomerById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          deliveryMethod: true,
          paymentStatus: true,
        },
      },
      bonusTransactions: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      },
      consents: {
        orderBy: { acceptedAt: "desc" },
      },
    },
  })

  if (!user) return null

  const totalSpent = user.orders
    .filter((o) => ["paid", "confirmed", "shipped", "delivered"].includes(o.status))
    .reduce((s, o) => s + o.total, 0)

  return { user, totalSpent }
}
