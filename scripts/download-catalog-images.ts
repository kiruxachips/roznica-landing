/**
 * One-off fetch script: downloads images for coffee products migrated from
 * millor-shop.ru and saves them as optimised WebP under
 * public/images/catalog/{slug}.webp. These static assets ship with the repo
 * and are referenced by prisma/data/millor-products.json.
 *
 * Run locally:  npx tsx scripts/download-catalog-images.ts
 */
import sharp from "sharp"
import { mkdir, writeFile, access } from "node:fs/promises"
import { join } from "node:path"

interface Item {
  slug: string
  url: string
}

// NOTE: images live on millor-shop.ru (not millor.ru). WebFetch sometimes
// mangles the host, so build URLs explicitly against the shop domain.
const BASE = "https://millor-shop.ru"

const items: Item[] = [
  { slug: "panama-arabica-shb-bouquete", url: `${BASE}/assets/images/products/82/medium/panama.webp` },
  { slug: "kenya-aaab", url: `${BASE}/assets/images/products/85/medium/keniya-scaled.jpg` },
  { slug: "tanzania-aa", url: `${BASE}/assets/images/products/84/medium/tanzania-1-scaled.jpg` },
  { slug: "brazil-yellow-bourbon", url: `${BASE}/assets/images/products/79/medium/brazil-scaled.jpg` },
  { slug: "blend-espresso", url: `${BASE}/assets/images/products/75/medium/espresso-1-scaled.jpg` },
  { slug: "blend-crema", url: `${BASE}/assets/images/products/76/medium/crema-scaled.jpg` },
  { slug: "blend-gurme", url: `${BASE}/assets/images/products/77/medium/gurme-1-scaled.jpg` },
  { slug: "salvador", url: `${BASE}/assets/images/products/86/medium/salvador-1-scaled.jpg` },
  { slug: "blend-dlya-neyo", url: `${BASE}/assets/images/products/117/medium/her-1-scaled.jpg` },
  { slug: "dominicana-barohona-aa", url: `${BASE}/assets/images/products/119/medium/dominican-scaled.jpg` },
  { slug: "kenigsbergskij-kofe", url: `${BASE}/assets/images/products/120/medium/keninsberg-1-scaled.jpg` },
  { slug: "indonesia", url: `${BASE}/assets/images/products/126/medium/indonesia-1-scaled.jpg` },
  { slug: "oro-rosso", url: `${BASE}/assets/images/products/150/medium/3.webp` },
  { slug: "oro-nero", url: `${BASE}/assets/images/products/151/medium/1.webp` },
  { slug: "oro-grano", url: `${BASE}/assets/images/products/152/medium/2.webp` },
]

async function main() {
  const outDir = join(process.cwd(), "public", "images", "catalog")
  await mkdir(outDir, { recursive: true })

  for (const item of items) {
    const out = join(outDir, `${item.slug}.webp`)
    try {
      await access(out)
      console.log(`↺ ${item.slug} (exists, skip)`)
      continue
    } catch {
      // file does not exist, proceed
    }

    const res = await fetch(item.url, {
      headers: { "User-Agent": "Mozilla/5.0 (Millor catalog sync)" },
    })
    if (!res.ok) {
      console.error(`✗ ${item.slug}: HTTP ${res.status}`)
      continue
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const webp = await sharp(buf)
      .webp({ quality: 85 })
      .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
      .toBuffer()
    await writeFile(out, webp)
    console.log(`+ ${item.slug} (${webp.length} bytes)`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
