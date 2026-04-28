// One-off: переключить cdek_tariffs со «склад-...» на «дверь-...».
// До этой миграции сайт считал доставку как «менеджер сам везёт на склад СДЭК».
// Теперь — CDEK-курьер забирает посылку у нас (door pickup), что соответствует
// фактическому процессу отправки.
//
// Скрипт обновляет значение, только если оно совпадает с одним из ранее использовавшихся
// дефолтов — кастомный выбор админа в /admin/delivery не трогает.
// Re-runnable safely.
//
// Usage: npx tsx scripts/migrate-cdek-tariffs-to-door.ts

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const NEW_TARIFFS = [231, 232, 138, 139] // эконом дверь-дверь / эконом дверь-ПВЗ / посылка дверь-ПВЗ / посылка дверь-дверь
const NEW_VALUE = JSON.stringify(NEW_TARIFFS)

// Все значения «дефолта» которые когда-либо лежали в seed.ts — если совпало,
// можно перезаписывать (это значит админ не менял). Любые другие сочетания
// считаем кастомными и не трогаем.
const KNOWN_DEFAULTS: number[][] = [
  [233, 234, 136, 137],
  [136, 137, 233, 234],
]

function arraysEqualUnordered(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  return sa.every((v, i) => v === sb[i])
}

function isKnownDefault(value: string): boolean {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return false
    return KNOWN_DEFAULTS.some((def) => arraysEqualUnordered(parsed, def))
  } catch {
    return false
  }
}

async function main() {
  console.log("Migrating cdek_tariffs to door-pickup variants...")

  const existing = await prisma.deliverySetting.findUnique({ where: { key: "cdek_tariffs" } })

  if (!existing) {
    await prisma.deliverySetting.create({ data: { key: "cdek_tariffs", value: NEW_VALUE } })
    console.log(`  + created cdek_tariffs = ${NEW_VALUE}`)
    return
  }

  if (existing.value === NEW_VALUE) {
    console.log(`  = already up-to-date: ${existing.value}`)
    return
  }

  if (isKnownDefault(existing.value)) {
    await prisma.deliverySetting.update({
      where: { key: "cdek_tariffs" },
      data: { value: NEW_VALUE },
    })
    console.log(`  ~ updated: "${existing.value}" → "${NEW_VALUE}"`)
    return
  }

  console.log(`  ! skipped — custom value detected: "${existing.value}"`)
  console.log(`    Поправить вручную в /admin/delivery → СДЭК → Тарифы.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
