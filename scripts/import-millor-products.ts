/**
 * Import script for Millor coffee products scraped from millor-shop.ru.
 *
 * Reads prisma/data/millor-products.json and upserts each product with its
 * variants, reviews, and (optionally) images. When a product entry includes
 * an "images" field, the script replaces ProductImage rows for that product
 * to match the JSON. Products without an "images" field keep whatever image
 * state is already in the DB (useful when images are managed via the admin
 * panel).
 *
 * Idempotent: re-running replaces variants, reviews, and (when present in
 * JSON) images — cascade delete + insert — so re-import stays fresh.
 *
 * Usage (inside docker container):
 *   docker exec roznica-landing npx tsx scripts/import-millor-products.ts
 */

import { PrismaClient } from "@prisma/client"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const prisma = new PrismaClient()

interface ImportVariant {
  weight: string
  price: number
  oldPrice?: number
}

interface ImportReview {
  name: string
  text: string
  rating: number
  date: string
}

interface ImportImage {
  url: string
  alt?: string
  isPrimary?: boolean
  sortOrder?: number
}

interface ImportProduct {
  slug: string
  name: string
  shortDescription: string
  fullDescription?: string
  origin?: string
  region?: string
  farm?: string
  altitude?: string
  roastLevel?: string
  processingMethod?: string
  flavorNotes?: string[]
  brewingMethods?: string[]
  acidity?: number | null
  sweetness?: number | null
  bitterness?: number | null
  body?: number | null
  badge?: string | null
  isFeatured?: boolean
  variants: ImportVariant[]
  reviews: ImportReview[]
  images?: ImportImage[]
}

const COFFEE_CATEGORY_SLUG = "zernovoy-kofe"
const DEFAULT_STOCK = 50
const DEFAULT_DESCRIPTION_MAX = 240

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + "…"
}

async function main() {
  const jsonPath = join(process.cwd(), "prisma/data/millor-products.json")
  const raw = readFileSync(jsonPath, "utf8")
  const products: ImportProduct[] = JSON.parse(raw)

  console.log(`Loaded ${products.length} products from ${jsonPath}`)

  const category = await prisma.category.findUnique({
    where: { slug: COFFEE_CATEGORY_SLUG },
  })
  if (!category) {
    throw new Error(`Category "${COFFEE_CATEGORY_SLUG}" not found. Seed it first.`)
  }
  console.log(`Target category: ${category.name} (${category.id})`)

  let created = 0
  let updated = 0

  for (const [index, p] of products.entries()) {
    const shortDesc = truncate(p.shortDescription, DEFAULT_DESCRIPTION_MAX)

    const data = {
      name: p.name,
      description: shortDesc,
      fullDescription: p.fullDescription ?? p.shortDescription,
      categoryId: category.id,
      isActive: true,
      isFeatured: p.isFeatured ?? false,
      badge: p.badge ?? null,
      sortOrder: index,
      origin: p.origin ?? null,
      region: p.region ?? null,
      farm: p.farm ?? null,
      altitude: p.altitude ?? null,
      roastLevel: p.roastLevel ?? null,
      processingMethod: p.processingMethod ?? null,
      flavorNotes: p.flavorNotes ?? [],
      brewingMethods: p.brewingMethods ?? [],
      acidity: p.acidity ?? null,
      sweetness: p.sweetness ?? null,
      bitterness: p.bitterness ?? null,
      body: p.body ?? null,
      metaTitle: `${p.name} — купить кофе | Millor Coffee`,
      metaDescription: shortDesc,
    }

    const existing = await prisma.product.findUnique({ where: { slug: p.slug } })

    const product = existing
      ? await prisma.product.update({ where: { slug: p.slug }, data })
      : await prisma.product.create({ data: { ...data, slug: p.slug } })

    if (existing) updated++
    else created++

    // Replace variants — delete existing + create fresh
    await prisma.productVariant.deleteMany({ where: { productId: product.id } })
    await prisma.productVariant.createMany({
      data: p.variants.map((v, i) => ({
        productId: product.id,
        weight: v.weight,
        price: v.price,
        oldPrice: v.oldPrice ?? null,
        sku: `${p.slug}-${v.weight}`.replace(/\s+/g, ""),
        stock: DEFAULT_STOCK,
        isActive: true,
        sortOrder: i,
      })),
    })

    // Replace reviews — delete existing + create fresh
    await prisma.review.deleteMany({ where: { productId: product.id } })
    if (p.reviews.length > 0) {
      await prisma.review.createMany({
        data: p.reviews.map((r) => ({
          productId: product.id,
          name: r.name,
          text: r.text,
          rating: Math.min(5, Math.max(1, r.rating)),
          date: r.date,
          isVisible: true,
        })),
      })
    }

    // Replace images only when the JSON entry specifies them; otherwise leave
    // the DB rows alone so admin-uploaded images are preserved.
    let imageCount = 0
    if (p.images && p.images.length > 0) {
      await prisma.productImage.deleteMany({ where: { productId: product.id } })
      await prisma.productImage.createMany({
        data: p.images.map((img, i) => ({
          productId: product.id,
          url: img.url,
          alt: img.alt ?? p.name,
          isPrimary: img.isPrimary ?? i === 0,
          sortOrder: img.sortOrder ?? i,
        })),
      })
      imageCount = p.images.length
    }

    console.log(
      `${existing ? "↺" : "+"} ${p.name} (${p.slug}) — ${p.variants.length} variants, ${p.reviews.length} reviews, ${imageCount} images`
    )
  }

  console.log(`\nDone. Created: ${created}, updated: ${updated}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
