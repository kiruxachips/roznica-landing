"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"

export async function createCollection(data: {
  name: string
  slug: string
  description?: string
  emoji?: string
}) {
  const admin = await requireAdmin("collections.edit")
  const col = await prisma.productCollection.create({ data })
  void logAdminAction({ admin, action: "collection.created", entityType: "collection", entityId: col.id, payload: data })
  revalidatePath("/admin/collections")
  revalidatePath("/catalog")
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
  revalidatePath("/admin/collections")
  revalidatePath(`/admin/collections/${id}`)
  revalidatePath("/catalog")
}

export async function deleteCollection(id: string) {
  const admin = await requireAdmin("collections.delete")
  await prisma.productCollection.delete({ where: { id } })
  void logAdminAction({ admin, action: "collection.deleted", entityType: "collection", entityId: id })
  revalidatePath("/admin/collections")
  revalidatePath("/catalog")
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
  revalidatePath(`/admin/collections/${collectionId}`)
  revalidatePath("/catalog")
}

export async function removeProductFromCollection(collectionId: string, productId: string) {
  await requireAdmin("collections.edit")
  await prisma.productCollectionItem.deleteMany({
    where: { collectionId, productId },
  })
  revalidatePath(`/admin/collections/${collectionId}`)
  revalidatePath("/catalog")
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
  revalidatePath("/catalog")
}
