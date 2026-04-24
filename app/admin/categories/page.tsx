export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { CategoryManager } from "./CategoryManager"
import { requireAdmin } from "@/lib/admin-guard"

export default async function AdminCategoriesPage() {
  await requireAdmin("categories.view")
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { products: true } },
    },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Категории</h1>
      <CategoryManager categories={categories.map((c) => ({ ...c, productCount: c._count.products }))} />
    </div>
  )
}
