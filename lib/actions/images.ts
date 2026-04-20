"use server"

import { prisma } from "@/lib/prisma"
import { getStorage } from "@/lib/storage"
import { revalidatePath, revalidateTag } from "next/cache"
import { CACHE_TAGS } from "@/lib/cache-tags"

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 // 10 MB

function invalidateProductImagesCache() {
  revalidateTag(CACHE_TAGS.products)
  revalidateTag(CACHE_TAGS.catalog)
  revalidatePath("/admin/products")
}

export async function uploadImage(formData: FormData) {
  const file = formData.get("file") as File
  const productId = formData.get("productId") as string

  if (!file || !productId) throw new Error("Missing file or productId")
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new Error(`Файл больше ${MAX_UPLOAD_SIZE / 1024 / 1024} МБ`)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`

  const storage = getStorage()
  const url = await storage.save(buffer, filename, productId)

  const existingCount = await prisma.productImage.count({ where: { productId } })

  const image = await prisma.productImage.create({
    data: {
      productId,
      url,
      alt: file.name.replace(/\.[^.]+$/, ""),
      isPrimary: existingCount === 0,
      sortOrder: existingCount,
    },
  })

  invalidateProductImagesCache()
  return image
}

export async function deleteImage(id: string) {
  const image = await prisma.productImage.findUnique({ where: { id } })
  if (!image) throw new Error("Image not found")

  const storage = getStorage()
  await storage.delete(image.url)
  await prisma.productImage.delete({ where: { id } })

  // If deleted image was primary, set next image as primary
  if (image.isPrimary) {
    const nextImage = await prisma.productImage.findFirst({
      where: { productId: image.productId },
      orderBy: { sortOrder: "asc" },
    })
    if (nextImage) {
      await prisma.productImage.update({
        where: { id: nextImage.id },
        data: { isPrimary: true },
      })
    }
  }

  invalidateProductImagesCache()
}

export async function setPrimaryImage(id: string) {
  const image = await prisma.productImage.findUnique({ where: { id } })
  if (!image) throw new Error("Image not found")

  await prisma.productImage.updateMany({
    where: { productId: image.productId },
    data: { isPrimary: false },
  })

  await prisma.productImage.update({
    where: { id },
    data: { isPrimary: true },
  })

  invalidateProductImagesCache()
}
