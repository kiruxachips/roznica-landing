import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import type { TasteProfile } from "@/lib/types"

export async function updateTasteProfile(
  userId: string,
  orderedProductIds: string[],
  orderTotal: number
): Promise<void> {
  const [products, user] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: orderedProductIds } },
      select: { id: true, flavorNotes: true, origin: true, roastLevel: true, productType: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { tasteProfile: true } }),
  ])

  const existing = (user?.tasteProfile ?? null) as unknown as TasteProfile | null
  const profile: TasteProfile = existing ?? {
    flavorNotes: {},
    origins: {},
    roastLevels: {},
    productTypes: {},
    avgOrderValue: 0,
    totalOrders: 0,
    purchasedProductIds: [],
    updatedAt: new Date().toISOString(),
  }

  for (const p of products) {
    for (const note of p.flavorNotes) {
      profile.flavorNotes[note] = (profile.flavorNotes[note] ?? 0) + 1
    }
    if (p.origin) profile.origins[p.origin] = (profile.origins[p.origin] ?? 0) + 1
    if (p.roastLevel) profile.roastLevels[p.roastLevel] = (profile.roastLevels[p.roastLevel] ?? 0) + 1
    profile.productTypes[p.productType] = (profile.productTypes[p.productType] ?? 0) + 1
    if (!profile.purchasedProductIds.includes(p.id)) profile.purchasedProductIds.push(p.id)
  }

  profile.avgOrderValue = profile.totalOrders === 0
    ? orderTotal
    : Math.round((profile.avgOrderValue * profile.totalOrders + orderTotal) / (profile.totalOrders + 1))
  profile.totalOrders += 1
  profile.updatedAt = new Date().toISOString()

  await prisma.user.update({ where: { id: userId }, data: { tasteProfile: profile as unknown as Prisma.InputJsonValue } })
}
