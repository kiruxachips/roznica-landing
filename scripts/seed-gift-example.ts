/**
 * GF3: создаёт один пример подарка для проверки gift-flow на проде.
 * Запускается вручную ОДИН раз после деплоя G-бандла:
 *   docker compose exec app npx tsx scripts/seed-gift-example.ts
 *
 * Идемпотентно: не создаёт дубль если подарок с таким name уже есть.
 * После установки админ может отредактировать или удалить через /admin/gifts.
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const EXAMPLE_NAME = "Образец свежеобжаренного кофе 50г"
  const existing = await prisma.gift.findFirst({ where: { name: EXAMPLE_NAME } })
  if (existing) {
    console.log(`[seed-gift] "${EXAMPLE_NAME}" уже существует (id=${existing.id}), пропускаем`)
    return
  }

  const gift = await prisma.gift.create({
    data: {
      name: EXAMPLE_NAME,
      description:
        "Миниатюрная упаковка свежеобжаренного кофе — выберем для вас интересный сорт из ассортимента. Отличный способ попробовать что-то новое без рисков.",
      minCartTotal: 3000,
      stock: null, // unlimited
      isActive: true,
      sortOrder: 0,
    },
  })

  console.log(`[seed-gift] создан подарок "${gift.name}" (id=${gift.id})`)
  console.log(`[seed-gift] доступен от ${gift.minCartTotal}₽, неограниченный запас`)
  console.log(`[seed-gift] отредактировать / деактивировать: /admin/gifts`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
