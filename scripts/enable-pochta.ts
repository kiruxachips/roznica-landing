// One-off: ensure Pochta RF is enabled on existing installations that were
// seeded before we flipped the default. Also inserts placeholder rows for
// new settings (dadata_api_key) if missing. Re-runnable safely.
//
// Usage: npx tsx scripts/enable-pochta.ts

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function upsert(key: string, value: string, overwriteIf?: (current: string) => boolean) {
  const existing = await prisma.deliverySetting.findUnique({ where: { key } })
  if (!existing) {
    await prisma.deliverySetting.create({ data: { key, value } })
    console.log(`  + created ${key} = ${value}`)
    return
  }
  if (overwriteIf && overwriteIf(existing.value)) {
    await prisma.deliverySetting.update({ where: { key }, data: { value } })
    console.log(`  ~ updated ${key}: "${existing.value}" → "${value}"`)
  } else {
    console.log(`  = kept ${key} = "${existing.value}"`)
  }
}

async function main() {
  console.log("Updating delivery settings...")

  // Turn on Pochta unless admin has explicitly saved "true" already.
  await upsert("pochta_enabled", "true", (cur) => cur !== "true")

  // Ensure new keys exist with sensible defaults.
  await upsert("dadata_api_key", "")

  console.log("Done.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
