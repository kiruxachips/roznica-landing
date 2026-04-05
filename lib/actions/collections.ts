"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createCollection(data: {
  name: string
  slug: string
  description?: string
  emoji?: string
}) {
  await prisma.productCollection.create({ data })
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
  await prisma.productCollection.update({ where: { id }, data })
  revalidatePath("/admin/collections")
  revalidatePath(`/admin/collections/${id}`)
  revalidatePath("/catalog")
}

export async function deleteCollection(id: string) {
  await prisma.productCollection.delete({ where: { id } })
  revalidatePath("/admin/collections")
  revalidatePath("/catalog")
}

export async function addProductToCollection(collectionId: string, productId: string) {
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
  await prisma.productCollectionItem.deleteMany({
    where: { collectionId, productId },
  })
  revalidatePath(`/admin/collections/${collectionId}`)
  revalidatePath("/catalog")
}

export async function syncProductCollections(productId: string, collectionIds: string[]) {
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
