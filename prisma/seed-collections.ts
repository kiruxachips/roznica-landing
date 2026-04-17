/**
 * Seed coffee collections and their product assignments.
 *
 * Collections are curated groupings shown on the catalog page (above the grid
 * when the coffee tab is active and no filters are applied). Each product can
 * belong to multiple collections; assignments are expressed by product slug
 * here so the seed is readable and easy to maintain.
 *
 * Idempotent: upserts the collection rows, then replaces ProductCollectionItem
 * entries for each collection so re-running the seed always lands on the
 * canonical set defined below.
 *
 * Usage (inside the app container):
 *   docker exec -w /app roznica-landing npx tsx prisma/seed-collections.ts
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

interface CollectionSeed {
  slug: string
  name: string
  emoji: string
  description: string
  sortOrder: number
  productSlugs: string[]
}

// Curated flavour-based groupings. A product may appear in more than one
// collection when the profile fits both (e.g. Blend Espresso → эспрессо AND
// с молоком). Order within each list controls display order.
//
// Invariant: every active coffee product MUST belong to ≥1 collection. The
// catalog defaults to showing collection sections only (no flat grid below),
// so an unclassified coffee would be invisible on the default view.
const COLLECTIONS: CollectionSeed[] = [
  {
    slug: "s-molokom",
    name: "Идеально с молоком",
    emoji: "🥛",
    description: "Низкая кислотность, шоколадно-ореховые и карамельные ноты — раскрываются в латте, капучино и флэт-уайт.",
    sortOrder: 1,
    productSlugs: [
      "brazil-yellow-bourbon",
      "brazil-santos",
      "honduras",
      "peru-gr1",
      "blend-espresso",
      "blend-crema",
      "blend-gurme",
      "blend-dlya-neyo",
      "oro-rosso",
      "dominicana-barohona-aa",
      "kenigsbergskij-kofe",
      "salvador",
      "uganda-bigusi-aa",
      "nicaragua-shg",
      "vietnam-arabica-scr-18",
      "papua-new-guinea",
      "panama-arabica-shb-bouquete",
    ],
  },
  {
    slug: "klassika",
    name: "Классика на каждый день",
    emoji: "☕",
    description: "Сбалансированные универсальные сорта без резких нот — подойдут к любому способу заваривания.",
    sortOrder: 2,
    productSlugs: [
      "brazil-santos",
      "colombia-supremo",
      "mexico",
      "honduras",
      "peru-gr1",
      "guatemala",
      "nicaragua-shg",
      "vietnam-arabica-scr-18",
      "brazilia-decaf",
      "salvador",
    ],
  },
  {
    slug: "shokoladno-orehovyy",
    name: "Шоколадно-ореховый профиль",
    emoji: "🍫",
    description: "Плотные сорта с нотами какао, тёмного шоколада, жареных орехов и карамели — для любителей «уютного» вкуса.",
    sortOrder: 3,
    productSlugs: [
      "indonesia",
      "uganda-bigusi-aa",
      "dominicana-barohona-aa",
      "kenigsbergskij-kofe",
      "tanzania-aa",
      "guatemala",
      "peru-gr1",
      "brazil-yellow-bourbon",
      "vietnam-arabica-scr-18",
      "oro-nero",
    ],
  },
  {
    slug: "s-kislinkoy",
    name: "Яркие и фруктовые",
    emoji: "🍋",
    description: "Выразительная кислотность, ягоды, цитрусы, цветы — чистая чашка без молока, фильтр, аэропресс.",
    sortOrder: 4,
    productSlugs: [
      "kenya-aaab",
      "ethiopia-yirgacheffe-gr-1",
      "tanzania-aa",
      "panama-arabica-shb-bouquete",
      "costa-rica",
      "rwanda",
      "burundi",
      "papua-new-guinea",
      "oro-grano",
      "mexico",
      "colombia-supremo",
    ],
  },
  {
    slug: "dlya-espresso",
    name: "Для эспрессо",
    emoji: "⚡",
    description: "Бленды и моносорта с плотным телом и устойчивой крема — созданы для эспрессо-машины и мокки.",
    sortOrder: 5,
    productSlugs: [
      "blend-espresso",
      "blend-crema",
      "blend-gurme",
      "blend-dlya-neyo",
      "oro-nero",
      "oro-rosso",
      "oro-grano",
      "robusta-india-cherry-aa",
    ],
  },
  {
    slug: "dlya-znatokov",
    name: "Для знатоков",
    emoji: "✨",
    description: "Сложные многогранные профили, редкие регионы и необычные ноты — кофе для тех, кто уже определился со вкусом.",
    sortOrder: 6,
    productSlugs: [
      "ethiopia-yirgacheffe-gr-1",
      "kenya-aaab",
      "rwanda",
      "burundi",
      "costa-rica",
      "indonesia",
      "robusta-india-cherry-aa",
    ],
  },
  {
    slug: "bez-kofeina",
    name: "Без кофеина",
    emoji: "🌙",
    description: "Кофе с извлечённым кофеином — вкус и аромат сохранены, можно пить вечером.",
    sortOrder: 7,
    productSlugs: ["brazilia-decaf"],
  },
  {
    slug: "alt-formaty",
    name: "Альтернативные форматы",
    emoji: "📦",
    description: "Готовый кофе в удобных форматах — для офиса, путешествий и тех случаев, когда нет кофеварки.",
    sortOrder: 8,
    productSlugs: ["drip-pakety-v-assortimente"],
  },
]

async function main() {
  console.log(`Seeding ${COLLECTIONS.length} collections…`)

  for (const c of COLLECTIONS) {
    // Resolve product IDs up front so we fail loudly on a typo rather than
    // silently dropping a product from a collection.
    const products = await prisma.product.findMany({
      where: { slug: { in: c.productSlugs } },
      select: { id: true, slug: true },
    })
    const foundSlugs = new Set(products.map((p) => p.slug))
    const missing = c.productSlugs.filter((s) => !foundSlugs.has(s))
    if (missing.length > 0) {
      console.warn(`  ⚠ ${c.slug}: missing product slugs → ${missing.join(", ")}`)
    }

    // Preserve original ordering from COLLECTIONS.productSlugs
    const slugToSortOrder = new Map(c.productSlugs.map((slug, i) => [slug, i]))

    const collection = await prisma.productCollection.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        emoji: c.emoji,
        description: c.description,
        sortOrder: c.sortOrder,
        isActive: true,
      },
      create: {
        slug: c.slug,
        name: c.name,
        emoji: c.emoji,
        description: c.description,
        sortOrder: c.sortOrder,
        isActive: true,
      },
    })

    // Replace items — simplest way to keep the assignment canonical.
    await prisma.productCollectionItem.deleteMany({
      where: { collectionId: collection.id },
    })
    if (products.length > 0) {
      await prisma.productCollectionItem.createMany({
        data: products.map((p) => ({
          collectionId: collection.id,
          productId: p.id,
          sortOrder: slugToSortOrder.get(p.slug) ?? 0,
        })),
      })
    }

    console.log(`  ✓ ${c.emoji} ${c.name} — ${products.length} products`)
  }

  // Sanity check: every active coffee must be in ≥1 collection. The catalog's
  // default view hides the flat grid, so unclassified coffees become invisible.
  const orphans = await prisma.product.findMany({
    where: {
      isActive: true,
      productType: "coffee",
      collections: { none: {} },
    },
    select: { slug: true, name: true },
  })
  if (orphans.length > 0) {
    console.warn(
      `\n⚠ ${orphans.length} coffee product(s) not assigned to any collection — they will not appear on /catalog:`
    )
    for (const o of orphans) console.warn(`    - ${o.name} (${o.slug})`)
  }

  console.log("Done.")
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
