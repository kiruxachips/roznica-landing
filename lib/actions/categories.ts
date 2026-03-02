"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createCategory(data: {
  name: string
  slug: string
  description?: string
  image?: string
  sortOrder?: number
}) {
  const category = await prisma.category.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      image: data.image || null,
      sortOrder: data.sortOrder ?? 0,
    },
  })

  revalidatePath("/admin/categories")
  revalidatePath("/catalog")
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
  const category = await prisma.category.update({
    where: { id },
    data,
  })

  revalidatePath("/admin/categories")
  revalidatePath("/catalog")
  return category
}

export async function deleteCategory(id: string) {
  const productsCount = await prisma.product.count({ where: { categoryId: id } })
  if (productsCount > 0) {
    throw new Error("Нельзя удалить категорию с товарами")
  }

  await prisma.category.delete({ where: { id } })
  revalidatePath("/admin/categories")
  revalidatePath("/catalog")
}
