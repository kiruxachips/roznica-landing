"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, revalidateTag } from "next/cache"
import { CACHE_TAGS } from "@/lib/cache-tags"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"

function invalidateCollections() {
  revalidateTag(CACHE_TAGS.collections)
  revalidateTag(CACHE_TAGS.catalog)
  revalidateTag(CACHE_TAGS.products)
  revalidatePath("/admin/collections")
  revalidatePath("/catalog")
}

export async function createCollection(data: {
  name: string
  slug: string
  description?: string
  emoji?: string
}) {
  const admin = await requireAdmin("collections.edit")
  const col = await prisma.productCollection.create({ data })
  void logAdminAction({ admin, action: "collection.created", entityType: "collection", entityId: col.id, payload: data })
  invalidateCollections()
}

export async function updateCollection(
  id: string,
  data: {
    name?: string
    slug?: string
    description?: string
    emoji?: string
    sortOrder?: number
    isActive?: boolean
  }
) {
  const admin = await requireAdmin("collections.edit")
  await prisma.productCollection.update({ where: { id }, data })
  void logAdminAction({ admin, action: "collection.updated", entityType: "collection", entityId: id, payload: { fields: Object.keys(data) } })
  invalidateCollections()
  revalidatePath(`/admin/collections/${id}`)
}

export async function deleteCollection(id: string) {
  // N-5: soft-delete через isActive=false. Раньше жёстко удаляли,
  // теряя все ProductCollectionItem — клиенты не могли вернуть коллекцию
  // если передумали. Теперь просто скрываем из каталога, все связи и
  // сортировки сохраняются.
  const admin = await requireAdmin("collections.delete")
  await prisma.productCollection.update({
    where: { id },
    data: { isActive: false },
  })
  void logAdminAction({ admin, action: "collection.archived", entityType: "collection", entityId: id })
  invalidateCollections()
}

export async function addProductToCollection(collectionId: string, productId: string) {
  await requireAdmin("collections.edit")
  const maxSort = await prisma.productCollectionItem.findFirst({
    where: { collectionId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  })
  await prisma.productCollectionItem.create({
    data: { collectionId, productId, sortOrder: (maxSort?.sortOrder ?? 0) + 1 },
  })
  invalidateCollections()
  revalidatePath(`/admin/collections/${collectionId}`)
}

export async function removeProductFromCollection(collectionId: string, productId: string) {
  await requireAdmin("collections.edit")
  await prisma.productCollectionItem.deleteMany({
    where: { collectionId, productId },
  })
  invalidateCollections()
  revalidatePath(`/admin/collections/${collectionId}`)
}

export async function syncProductCollections(productId: string, collectionIds: string[]) {
  await requireAdmin("collections.edit")
  await prisma.$transaction([
    prisma.productCollectionItem.deleteMany({ where: { productId } }),
    ...collectionIds.map((collectionId, i) =>
      prisma.productCollectionItem.create({
        data: { collectionId, productId, sortOrder: i },
      })
    ),
  ])
  invalidateCollections()
}
