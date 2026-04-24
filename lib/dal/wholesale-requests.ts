import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

export interface WholesaleAccessRequestInput {
  legalName: string
  inn: string
  contactName: string
  contactPhone: string
  contactEmail: string
  expectedVolume?: string | null
  comment?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

function validateInn(inn: string): boolean {
  const clean = inn.replace(/\D/g, "")
  return clean.length === 10 || clean.length === 12
}

function validatePhone(phone: string): boolean {
  const clean = phone.replace(/\D/g, "")
  return clean.length === 11 && (clean.startsWith("7") || clean.startsWith("8"))
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function createAccessRequest(input: WholesaleAccessRequestInput) {
  if (!input.legalName.trim()) throw new Error("Укажите название юрлица")
  if (!validateInn(input.inn)) throw new Error("Некорректный ИНН (должно быть 10 или 12 цифр)")
  if (!input.contactName.trim()) throw new Error("Укажите имя контактного лица")
  if (!validatePhone(input.contactPhone)) throw new Error("Некорректный телефон")
  if (!validateEmail(input.contactEmail)) throw new Error("Некорректный email")

  const email = input.contactEmail.toLowerCase().trim()
  const inn = input.inn.replace(/\D/g, "")

  // Проверка: уже есть компания с таким ИНН
  const existingCompany = await prisma.wholesaleCompany.findUnique({ where: { inn } })
  if (existingCompany) {
    throw new Error("Компания с таким ИНН уже зарегистрирована. Если вы забыли пароль — используйте сброс.")
  }

  // Проверка: уже есть активная (pending) заявка с таким ИНН
  const pendingRequest = await prisma.wholesaleAccessRequest.findFirst({
    where: { inn, status: "pending" },
  })
  if (pendingRequest) {
    throw new Error("Заявка по этому ИНН уже на рассмотрении. Дождитесь решения.")
  }

  return prisma.wholesaleAccessRequest.create({
    data: {
      legalName: input.legalName.trim(),
      inn,
      contactName: input.contactName.trim(),
      contactPhone: input.contactPhone,
      contactEmail: email,
      expectedVolume: input.expectedVolume?.trim() || null,
      comment: input.comment?.trim() || null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  })
}

export async function listAccessRequests(filter?: {
  status?: string
  search?: string
}) {
  const where: Prisma.WholesaleAccessRequestWhereInput = {}
  if (filter?.status && filter.status !== "all") where.status = filter.status
  if (filter?.search) {
    where.OR = [
      { legalName: { contains: filter.search, mode: "insensitive" } },
      { inn: { contains: filter.search } },
      { contactEmail: { contains: filter.search, mode: "insensitive" } },
    ]
  }

  return prisma.wholesaleAccessRequest.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  })
}

export async function getAccessRequestById(id: string) {
  return prisma.wholesaleAccessRequest.findUnique({
    where: { id },
    include: { company: true },
  })
}
