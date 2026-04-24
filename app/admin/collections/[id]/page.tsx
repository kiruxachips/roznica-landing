export const dynamic = "force-dynamic"

import { notFound } from "next/navigation"
import { getCollectionById } from "@/lib/dal/collections"
import { prisma } from "@/lib/prisma"
import { CollectionForm } from "@/components/admin/CollectionForm"
import { requireAdmin } from "@/lib/admin-guard"

export default async function AdminCollectionEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("collections.edit")
  const { id } = await params
  const collection = await getCollectionById(id)
  if (!collection) notFound()

  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  })

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">
        {collection.emoji && `${collection.emoji} `}{collection.name}
      </h1>
      <CollectionForm collection={collection} allProducts={allProducts} />
    </div>
  )
}
