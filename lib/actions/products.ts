"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function createProduct(data: {
  name: string
  slug: string
  description: string
  fullDescription?: string
  categoryId: string
  isActive?: boolean
  isFeatured?: boolean
  badge?: string
  origin?: string
  region?: string
  farm?: string
  altitude?: string
  roastLevel?: string
  processingMethod?: string
  flavorNotes?: string[]
  acidity?: number
  sweetness?: number
  bitterness?: number
  body?: number
  brewingMethods?: string[]
  metaTitle?: string
  metaDescription?: string
}) {
  const product = await prisma.product.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      fullDescription: data.fullDescription || null,
      categoryId: data.categoryId,
      isActive: data.isActive ?? true,
      isFeatured: data.isFeatured ?? false,
      badge: data.badge || null,
      origin: data.origin || null,
      region: data.region || null,
      farm: data.farm || null,
      altitude: data.altitude || null,
      roastLevel: data.roastLevel || null,
      processingMethod: data.processingMethod || null,
      flavorNotes: data.flavorNotes ?? [],
      acidity: data.acidity ?? null,
      sweetness: data.sweetness ?? null,
      bitterness: data.bitterness ?? null,
      body: data.body ?? null,
      brewingMethods: data.brewingMethods ?? [],
      metaTitle: data.metaTitle || null,
      metaDescription: data.metaDescription || null,
    },
  })

  revalidatePath("/admin/products")
  revalidatePath("/catalog")
  revalidatePath("/")

  return product
}

export async function updateProduct(
  id: string,
  data: {
    name?: string
    slug?: string
    description?: string
    fullDescription?: string
    categoryId?: string
    isActive?: boolean
    isFeatured?: boolean
    badge?: string
    sortOrder?: number
    origin?: string
    region?: string
    farm?: string
    altitude?: string
    roastLevel?: string
    processingMethod?: string
    flavorNotes?: string[]
    acidity?: number
    sweetness?: number
    bitterness?: number
    body?: number
    brewingMethods?: string[]
    metaTitle?: string
    metaDescription?: string
  }
) {
  const product = await prisma.product.update({
    where: { id },
    data,
  })

  revalidatePath("/admin/products")
  revalidatePath(`/catalog/${product.slug}`)
  revalidatePath("/catalog")
  revalidatePath("/")

  return product
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } })

  revalidatePath("/admin/products")
  revalidatePath("/catalog")
  revalidatePath("/")
}

export async function toggleProductActive(id: string) {
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) throw new Error("Product not found")

  await prisma.product.update({
    where: { id },
    data: { isActive: !product.isActive },
  })

  revalidatePath("/admin/products")
  revalidatePath("/catalog")
  revalidatePath("/")
}

// Variants
export async function createVariant(data: {
  productId: string
  weight: string
  price: number
  oldPrice?: number
  sku?: string
  stock?: number
  sortOrder?: number
}) {
  const variant = await prisma.productVariant.create({ data })
  revalidatePath("/admin/products")
  revalidatePath("/catalog")
  return variant
}

export async function updateVariant(
  id: string,
  data: {
    weight?: string
    price?: number
    oldPrice?: number | null
    sku?: string
    stock?: number
    isActive?: boolean
    sortOrder?: number
  }
) {
  const variant = await prisma.productVariant.update({ where: { id }, data })
  revalidatePath("/admin/products")
  revalidatePath("/catalog")
  return variant
}

export async function deleteVariant(id: string) {
  await prisma.productVariant.delete({ where: { id } })
  revalidatePath("/admin/products")
  revalidatePath("/catalog")
}

// Promotions
export async function updatePromotion(
  productId: string,
  data: {
    isFeatured?: boolean
    badge?: string | null
    sortOrder?: number
    variants?: { id: string; price?: number; oldPrice?: number | null }[]
  }
) {
  await prisma.product.update({
    where: { id: productId },
    data: {
      ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
      ...(data.badge !== undefined && { badge: data.badge || null }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
  })

  if (data.variants) {
    for (const v of data.variants) {
      await prisma.productVariant.update({
        where: { id: v.id },
        data: {
          ...(v.price !== undefined && { price: v.price }),
          ...(v.oldPrice !== undefined && { oldPrice: v.oldPrice }),
        },
      })
    }
  }

  revalidatePath("/admin/promotions")
  revalidatePath("/catalog")
  revalidatePath("/")
}
