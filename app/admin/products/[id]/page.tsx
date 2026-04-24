import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ProductForm } from "@/components/admin/ProductForm"
import { getAllCollections, getCollectionIdsForProduct } from "@/lib/dal/collections"
import { requireAdmin } from "@/lib/admin-guard"

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("products.edit")
  const { id } = await params

  const [product, categories, allCollections, productCollectionIds] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { sortOrder: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    getAllCollections(),
    getCollectionIdsForProduct(id),
  ])

  if (!product) notFound()

  const collections = allCollections.map((c) => ({ id: c.id, name: c.name, emoji: c.emoji }))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Редактирование: {product.name}</h1>
      <ProductForm product={product} categories={categories} collections={collections} productCollectionIds={productCollectionIds} />
    </div>
  )
}
