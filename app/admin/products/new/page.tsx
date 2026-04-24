import { prisma } from "@/lib/prisma"
import { ProductForm } from "@/components/admin/ProductForm"
import { requireAdmin } from "@/lib/admin-guard"

export default async function NewProductPage() {
  await requireAdmin("products.edit")
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, slug: true },
  })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Новый товар</h1>
      <ProductForm categories={categories} />
    </div>
  )
}
