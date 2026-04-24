import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export interface WholesaleCompanySummary {
  id: string
  legalName: string
  inn: string
  status: string
  paymentTerms: string
  creditLimit: number
  creditUsed: number
  priceListId: string | null
}

export interface WholesaleContext {
  userId: string
  email: string
  name: string
  companyId: string
  company: WholesaleCompanySummary
}

/**
 * Строгая проверка: запрос должен делать авторизованный wholesale-пользователь
 * активной компании. Компанию читаем из БД (не из JWT) — статус может
 * измениться между обновлениями токена.
 *
 * Бросает Error если что-то не так. Использовать в server actions и
 * защищённых API-routes оптового кабинета.
 */
export async function requireWholesale(): Promise<WholesaleContext> {
  const session = await auth()
  const u = session?.user
  if (!u?.id || u.userType !== "wholesale" || !u.companyId) {
    throw new Error("Нет доступа: требуется вход как оптовый клиент")
  }

  const user = await prisma.wholesaleUser.findUnique({
    where: { id: u.id },
    include: {
      company: {
        select: {
          id: true,
          legalName: true,
          inn: true,
          status: true,
          paymentTerms: true,
          creditLimit: true,
          creditUsed: true,
          priceListId: true,
        },
      },
    },
  })

  if (!user || user.status !== "active") {
    throw new Error("Нет доступа: учётная запись неактивна")
  }
  if (user.company.status === "suspended") {
    throw new Error("Доступ приостановлен. Свяжитесь с менеджером.")
  }
  if (user.company.status === "rejected") {
    throw new Error("Компания отклонена в оптовом доступе.")
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    companyId: user.company.id,
    company: user.company,
  }
}

/**
 * Мягкая проверка — возвращает null если нет доступа (для UI).
 */
export async function getWholesaleContext(): Promise<WholesaleContext | null> {
  try {
    return await requireWholesale()
  } catch {
    return null
  }
}
