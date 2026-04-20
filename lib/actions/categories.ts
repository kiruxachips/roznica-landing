"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, revalidateTag } from "next/cache"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"
import { CACHE_TAGS } from "@/lib/cache-tags"

function invalidateCategoriesCache() {
  revalidateTag(CACHE_TAGS.catalog)
  revalidateTag(CACHE_TAGS.products)
  revalidateTag(CACHE_TAGS.filters)
  revalidatePath("/admin/categories")
}

export async function createCategory(data: {
  name: string
  slug: string
  description?: string
  image?: string
  sortOrder?: number
}) {
  const admin = await requireAdmin("categories.edit")
  const category = await prisma.category.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      image: data.image || null,
      sortOrder: data.sortOrder ?? 0,
    },
  })

  void logAdminAction({
    admin,
    action: "category.created",
    entityType: "category",
    entityId: category.id,
    payload: { name: category.name, slug: category.slug },
  })
  invalidateCategoriesCache()
  return category
}

export async function updateCategory(
  id: string,
  data: {
    name?: string
    slug?: string
    description?: string
    image?: string
    sortOrder?: number
    isActive?: boolean
  }
) {
  const admin = await requireAdmin("categories.edit")
  const category = await prisma.category.update({
    where: { id },
    data,
  })

  void logAdminAction({
    admin,
    action: "category.updated",
    entityType: "category",
    entityId: id,
    payload: { fields: Object.keys(data) },
  })
  invalidateCategoriesCache()
  return category
}

export async function deleteCategory(id: string) {
  const admin = await requireAdmin("categories.delete")
  const productsCount = await prisma.product.count({ where: { categoryId: id } })
  if (productsCount > 0) {
    throw new Error("Нельзя удалить категорию с товарами")
  }

  await prisma.category.delete({ where: { id } })
  void logAdminAction({
    admin,
    action: "category.deleted",
    entityType: "category",
    entityId: id,
  })
  invalidateCategoriesCache()
}
