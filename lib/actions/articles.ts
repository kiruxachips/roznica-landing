"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getStorage } from "@/lib/storage"

export async function createArticle(data: {
  title: string
  slug: string
  excerpt: string
  content: string
  categoryId?: string
  tags?: string[]
  isPublished?: boolean
  publishedAt?: string
  metaTitle?: string
  metaDescription?: string
}) {
  const article = await prisma.article.create({
    data: {
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt,
      content: data.content,
      categoryId: data.categoryId || null,
      tags: data.tags ?? [],
      isPublished: data.isPublished ?? false,
      publishedAt: data.isPublished ? (data.publishedAt ? new Date(data.publishedAt) : new Date()) : null,
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
    },
  })

  revalidatePath("/admin/blog")
  revalidatePath("/blog")
  return article
}

export async function updateArticle(
  id: string,
  data: {
    title?: string
    slug?: string
    excerpt?: string
    content?: string
    categoryId?: string | null
    tags?: string[]
    isPublished?: boolean
    publishedAt?: string | null
    metaTitle?: string
    metaDescription?: string
  }
) {
  const existing = await prisma.article.findUnique({ where: { id } })
  if (!existing) throw new Error("Статья не найдена")

  const updateData: Record<string, unknown> = { ...data }

  // Handle publishedAt
  if (data.publishedAt !== undefined) {
    updateData.publishedAt = data.publishedAt ? new Date(data.publishedAt) : null
  } else if (data.isPublished && !existing.publishedAt) {
    updateData.publishedAt = new Date()
  }

  // Handle nullable categoryId
  if (data.categoryId === "") {
    updateData.categoryId = null
  }

  const article = await prisma.article.update({
    where: { id },
    data: updateData,
  })

  revalidatePath("/admin/blog")
  revalidatePath("/blog")
  revalidatePath(`/blog/${article.slug}`)
  return article
}

export async function deleteArticle(id: string) {
  const article = await prisma.article.findUnique({ where: { id } })
  if (!article) throw new Error("Статья не найдена")

  // Delete cover image from FS
  if (article.coverImage) {
    const storage = getStorage()
    await storage.delete(article.coverImage)
  }

  await prisma.article.delete({ where: { id } })

  revalidatePath("/admin/blog")
  revalidatePath("/blog")
}

export async function toggleArticlePublished(id: string) {
  const article = await prisma.article.findUnique({ where: { id } })
  if (!article) throw new Error("Статья не найдена")

  const isPublished = !article.isPublished
  await prisma.article.update({
    where: { id },
    data: {
      isPublished,
      publishedAt: isPublished && !article.publishedAt ? new Date() : article.publishedAt,
    },
  })

  revalidatePath("/admin/blog")
  revalidatePath("/blog")
  revalidatePath(`/blog/${article.slug}`)
}

export async function uploadArticleCoverImage(formData: FormData) {
  const file = formData.get("file") as File
  const articleId = formData.get("articleId") as string
  if (!file || !articleId) throw new Error("Файл и ID статьи обязательны")

  const buffer = Buffer.from(await file.arrayBuffer())
  const storage = getStorage()

  // Delete old cover if exists
  const article = await prisma.article.findUnique({ where: { id: articleId } })
  if (article?.coverImage) {
    await storage.delete(article.coverImage)
  }

  const filename = `cover-${Date.now()}.webp`
  const url = await storage.save(buffer, filename, articleId, "articles")

  await prisma.article.update({
    where: { id: articleId },
    data: { coverImage: url },
  })

  revalidatePath("/admin/blog")
  revalidatePath("/blog")
  return url
}

export async function deleteArticleCoverImage(articleId: string) {
  const article = await prisma.article.findUnique({ where: { id: articleId } })
  if (!article?.coverImage) return

  const storage = getStorage()
  await storage.delete(article.coverImage)

  await prisma.article.update({
    where: { id: articleId },
    data: { coverImage: null },
  })

  revalidatePath("/admin/blog")
  revalidatePath("/blog")
}

export async function uploadArticleContentImage(formData: FormData) {
  const file = formData.get("file") as File
  const articleId = formData.get("articleId") as string
  if (!file || !articleId) throw new Error("Файл и ID статьи обязательны")

  const buffer = Buffer.from(await file.arrayBuffer())
  const storage = getStorage()

  const filename = `content-${Date.now()}.webp`
  const url = await storage.save(buffer, filename, articleId, "articles")

  return url
}
