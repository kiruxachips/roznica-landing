"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createArticleCategory(data: {
  name: string
  slug: string
  description?: string
  sortOrder?: number
}) {
  const category = await prisma.articleCategory.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      sortOrder: data.sortOrder ?? 0,
    },
  })

  revalidatePath("/admin/blog/categories")
  revalidatePath("/blog")
  return category
}

export async function updateArticleCategory(
  id: string,
  data: {
    name?: string
    slug?: string
    description?: string
    sortOrder?: number
    isActive?: boolean
  }
) {
  const category = await prisma.articleCategory.update({
    where: { id },
    data,
  })

  revalidatePath("/admin/blog/categories")
  revalidatePath("/blog")
  return category
}

export async function deleteArticleCategory(id: string) {
  const articleCount = await prisma.article.count({ where: { categoryId: id } })
  if (articleCount > 0) {
    throw new Error("Нельзя удалить рубрику с привязанными статьями")
  }

  await prisma.articleCategory.delete({ where: { id } })
  revalidatePath("/admin/blog/categories")
  revalidatePath("/blog")
}
