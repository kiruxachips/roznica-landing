"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { adjustStock } from "@/lib/dal/stock"
import { notifyStockChange } from "@/lib/integrations/stock-alerts"
import { auth } from "@/lib/auth"

export async function createProduct(data: {
  name: string
  slug: string
  description: string
  fullDescription?: string
  categoryId: string
  isActive?: boolean
  isFeatured?: boolean
  badge?: string
  productType?: string
  productForm?: string
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
  variants?: { weight: string; price: number; oldPrice?: number | null; stock: number }[]
}) {
  const { variants, ...productData } = data

  const product = await prisma.product.create({
    data: {
      name: productData.name,
      slug: productData.slug,
      description: productData.description,
      fullDescription: productData.fullDescription || null,
      categoryId: productData.categoryId,
      isActive: productData.isActive ?? true,
      isFeatured: productData.isFeatured ?? false,
      badge: productData.badge || null,
      productType: productData.productType ?? "coffee",
      productForm: productData.productForm || null,
      origin: productData.origin || null,
      region: productData.region || null,
      farm: productData.farm || null,
      altitude: productData.altitude || null,
      roastLevel: productData.roastLevel || null,
      processingMethod: productData.processingMethod || null,
      flavorNotes: productData.flavorNotes ?? [],
      acidity: productData.acidity ?? null,
      sweetness: productData.sweetness ?? null,
      bitterness: productData.bitterness ?? null,
      body: productData.body ?? null,
      brewingMethods: productData.brewingMethods ?? [],
      metaTitle: productData.metaTitle || null,
      metaDescription: productData.metaDescription || null,
      ...(variants && variants.length > 0 && {
        variants: {
          createMany: {
            data: variants.map((v, i) => ({
              weight: v.weight,
              price: v.price,
              oldPrice: v.oldPrice ?? null,
              stock: v.stock,
              sortOrder: i,
            })),
          },
        },
      }),
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
    productType?: string
    productForm?: string
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
  // Вариант создаём с нулевым stock, потом отдельной записью adjustStock
  // фиксируем начальное количество как «приход» — чтобы StockHistory содержала
  // полную историю с момента создания.
  const initialStock = data.stock ?? 0
  const variant = await prisma.productVariant.create({
    data: { ...data, stock: 0 },
  })
  if (initialStock > 0) {
    const session = await auth()
    const adminId = (session?.user as { id?: string } | undefined)?.id || "admin"
    await adjustStock({
      variantId: variant.id,
      delta: initialStock,
      reason: "supplier_received",
      notes: "Начальное количество при создании варианта",
      changedBy: adminId,
    })
  }
  revalidatePath("/admin/products")
  revalidatePath("/admin/warehouse")
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
    lowStockThreshold?: number | null
    isActive?: boolean
    sortOrder?: number
  }
) {
  const { stock, ...rest } = data

  // Stock меняется через adjustStock — чтобы зафиксировать причину и историю
  if (stock !== undefined) {
    const current = await prisma.productVariant.findUnique({
      where: { id },
      select: { stock: true },
    })
    if (!current) throw new Error("Вариант не найден")
    const delta = stock - current.stock
    if (delta !== 0) {
      const session = await auth()
      const adminId = (session?.user as { id?: string } | undefined)?.id || "admin"
      const result = await adjustStock({
        variantId: id,
        delta,
        reason: "inventory_correction",
        notes: "Inline-редактирование в админке",
        changedBy: adminId,
      })
      void notifyStockChange(result)
    }
  }

  // Остальные поля обновляем напрямую
  const variant =
    Object.keys(rest).length > 0
      ? await prisma.productVariant.update({ where: { id }, data: rest })
      : await prisma.productVariant.findUnique({ where: { id } })

  revalidatePath("/admin/products")
  revalidatePath("/admin/warehouse")
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
