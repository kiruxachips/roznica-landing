"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, revalidateTag } from "next/cache"
import { adjustStock } from "@/lib/dal/stock"
import { notifyStockChange } from "@/lib/integrations/stock-alerts"
import { requireAdmin, logAdminAction } from "@/lib/admin-guard"
import { CACHE_TAGS } from "@/lib/cache-tags"

function invalidateCatalogCache() {
  revalidateTag(CACHE_TAGS.products)
  revalidateTag(CACHE_TAGS.catalog)
  revalidateTag(CACHE_TAGS.homepage)
  revalidateTag(CACHE_TAGS.filters)
  revalidateTag(CACHE_TAGS.stats)
  revalidateTag(CACHE_TAGS.sitemap)
  revalidatePath("/admin/products")
}

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
  const admin = await requireAdmin("products.create")
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

  invalidateCatalogCache()

  void logAdminAction({
    admin,
    action: "product.created",
    entityType: "product",
    entityId: product.id,
    payload: { name: product.name, slug: product.slug },
  })
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
  const admin = await requireAdmin("products.edit")
  const product = await prisma.product.update({
    where: { id },
    data,
  })

  invalidateCatalogCache()
  revalidateTag(CACHE_TAGS.product(product.slug))

  void logAdminAction({
    admin,
    action: "product.updated",
    entityType: "product",
    entityId: product.id,
    payload: { fields: Object.keys(data) },
  })
  return product
}

export async function deleteProduct(id: string) {
  const admin = await requireAdmin("products.delete")
  const snapshot = await prisma.product.findUnique({ where: { id }, select: { name: true, slug: true } })
  await prisma.product.delete({ where: { id } })

  invalidateCatalogCache()

  void logAdminAction({
    admin,
    action: "product.deleted",
    entityType: "product",
    entityId: id,
    payload: snapshot || undefined,
  })
}

export async function toggleProductActive(id: string) {
  const admin = await requireAdmin("products.toggleActive")
  const product = await prisma.product.findUnique({ where: { id } })
  if (!product) throw new Error("Product not found")

  await prisma.product.update({
    where: { id },
    data: { isActive: !product.isActive },
  })

  invalidateCatalogCache()

  void logAdminAction({
    admin,
    action: "product.toggleActive",
    entityType: "product",
    entityId: id,
    payload: { wasActive: product.isActive, nowActive: !product.isActive },
  })
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
  const admin = await requireAdmin("variants.create")
  // Вариант создаём с нулевым stock, потом отдельной записью adjustStock
  // фиксируем начальное количество как «приход» — чтобы StockHistory содержала
  // полную историю с момента создания.
  const initialStock = data.stock ?? 0
  const variant = await prisma.productVariant.create({
    data: { ...data, stock: 0 },
  })
  if (initialStock > 0) {
    await adjustStock({
      variantId: variant.id,
      delta: initialStock,
      reason: "supplier_received",
      notes: "Начальное количество при создании варианта",
      changedBy: admin.userId,
    })
  }
  revalidatePath("/admin/warehouse")
  invalidateCatalogCache()
  void logAdminAction({
    admin,
    action: "variant.created",
    entityType: "variant",
    entityId: variant.id,
    payload: { weight: variant.weight, initialStock },
  })
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
  const admin = await requireAdmin("variants.edit")
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
      const result = await adjustStock({
        variantId: id,
        delta,
        reason: "inventory_correction",
        notes: "Inline-редактирование в админке",
        changedBy: admin.userId,
      })
      void notifyStockChange(result)
    }
  }

  // Остальные поля обновляем напрямую
  const variant =
    Object.keys(rest).length > 0
      ? await prisma.productVariant.update({ where: { id }, data: rest })
      : await prisma.productVariant.findUnique({ where: { id } })

  revalidatePath("/admin/warehouse")
  invalidateCatalogCache()
  void logAdminAction({
    admin,
    action: "variant.updated",
    entityType: "variant",
    entityId: id,
    payload: { fields: Object.keys(data) },
  })
  return variant
}

export async function deleteVariant(id: string) {
  const admin = await requireAdmin("variants.delete")
  const snapshot = await prisma.productVariant.findUnique({
    where: { id },
    select: { weight: true, productId: true },
  })
  await prisma.productVariant.delete({ where: { id } })
  void logAdminAction({
    admin,
    action: "variant.deleted",
    entityType: "variant",
    entityId: id,
    payload: snapshot || undefined,
  })
  invalidateCatalogCache()
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
  invalidateCatalogCache()
}
