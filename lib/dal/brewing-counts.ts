import { prisma } from "@/lib/prisma"

/**
 * Returns count of active products per brewing method.
 * Used on the home CategoryTiles section to show "Эспрессо (12)".
 */
export async function getBrewingCounts(): Promise<Record<string, number>> {
  try {
    const rows = await prisma.product.findMany({
      where: { isActive: true },
      select: { brewingMethods: true },
    })
    const counts: Record<string, number> = {}
    for (const row of rows) {
      for (const method of row.brewingMethods) {
        counts[method] = (counts[method] ?? 0) + 1
      }
    }
    return counts
  } catch {
    return {}
  }
}
