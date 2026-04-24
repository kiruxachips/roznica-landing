export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { PromotionManager } from "@/components/admin/PromotionManager"
import { requireAdmin } from "@/lib/admin-guard"

export default async function AdminPromotionsPage() {
  await requireAdmin("promos.view")
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      category: { slug: "zernovoy-kofe" },
    },
    orderBy: { sortOrder: "asc" },
    include: {
      images: { where: { isPrimary: true }, take: 1 },
      variants: { orderBy: { sortOrder: "asc" } },
    },
  })

  const serialized = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    isFeatured: p.isFeatured,
    badge: p.badge,
    sortOrder: p.sortOrder,
    image: p.images[0]?.url ?? null,
    variants: p.variants.map((v) => ({
      id: v.id,
      weight: v.weight,
      price: v.price,
      oldPrice: v.oldPrice,
      isActive: v.isActive,
    })),
  }))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Акции на главной</h1>
      <PromotionManager products={serialized} />
    </div>
  )
}
