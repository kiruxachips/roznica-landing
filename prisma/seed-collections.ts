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
// хорош с молоком). Order within each list controls display order.
const COLLECTIONS: CollectionSeed[] = [
  {
    slug: "s-molokom",
    name: "Идеально с молоком",
    emoji: "🥛",
    description: "Низкая кислотность, шоколадно-ореховые и карамельные ноты — раскрываются в латте, капучино и флэт-уайт.",
    sortOrder: 1,
    productSlugs: [
      "brazil-santos",
      "brazil-yellow-bourbon",
      "honduras",
      "peru-gr1",
      "uganda-bigusi-aa",
      "blend-espresso",
      "blend-crema",
      "blend-gurme",
      "blend-dlya-neyo",
      "oro-rosso",
      "salvador",
      "dominicana-barohona-aa",
      "kenigsbergskij-kofe",
      "indonesia",
    ],
  },
  {
    slug: "klassika",
    name: "Классика",
    emoji: "☕",
    description: "Сбалансированные сорта на каждый день: без резкой кислинки, с тёплым шоколадно-ореховым профилем.",
    sortOrder: 2,
    productSlugs: [
      "brazil-santos",
      "colombia-supremo",
      "mexico",
      "honduras",
      "peru-gr1",
      "guatemala",
      "vietnam-arabica-scr-18",
      "nicaragua-shg",
      "brazil-yellow-bourbon",
    ],
  },
  {
    slug: "s-kislinkoy",
    name: "С кислинкой и фруктами",
    emoji: "🍋",
    description: "Яркие, ягодные и цитрусовые профили — для тех, кто любит фильтр-кофе и чистую чашку без молока.",
    sortOrder: 3,
    productSlugs: [
      "ethiopia-yirgacheffe-gr-1",
      "kenya-aaab",
      "tanzania-aa",
      "rwanda",
      "costa-rica",
      "burundi",
      "panama-arabica-shb-bouquete",
      "papua-new-guinea",
      "oro-grano",
    ],
  },
  {
    slug: "dlya-espresso",
    name: "Для эспрессо",
    emoji: "⚡",
    description: "Бленды и моносорта с плотным телом и устойчивой крема — созданы для эспрессо-машины и мокки.",
    sortOrder: 4,
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
    slug: "bez-kofeina",
    name: "Без кофеина",
    emoji: "🌙",
    description: "Кофе с извлечённым кофеином — вкус и аромат сохранены, можно пить вечером.",
    sortOrder: 5,
    productSlugs: ["brazilia-decaf"],
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
