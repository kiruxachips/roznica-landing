"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"

export async function createArticleCategory(data: {
  name: string
  slug: string
  description?: string
  sortOrder?: number
}) {
  const admin = await requireAdmin("blog.edit")
  const category = await prisma.articleCategory.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      sortOrder: data.sortOrder ?? 0,
    },
  })

  void logAdminAction({ admin, action: "article_category.created", entityType: "article_category", entityId: category.id, payload: { name: category.name } })
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
  const admin = await requireAdmin("blog.edit")
  const category = await prisma.articleCategory.update({
    where: { id },
    data,
  })

  void logAdminAction({ admin, action: "article_category.updated", entityType: "article_category", entityId: id, payload: { fields: Object.keys(data) } })
  revalidatePath("/admin/blog/categories")
  revalidatePath("/blog")
  return category
}

export async function deleteArticleCategory(id: string) {
  const admin = await requireAdmin("blog.delete")
  const articleCount = await prisma.article.count({ where: { categoryId: id } })
  if (articleCount > 0) {
    throw new Error("Нельзя удалить рубрику с привязанными статьями")
  }

  await prisma.articleCategory.delete({ where: { id } })
  void logAdminAction({ admin, action: "article_category.deleted", entityType: "article_category", entityId: id })
  revalidatePath("/admin/blog/categories")
  revalidatePath("/blog")
}
