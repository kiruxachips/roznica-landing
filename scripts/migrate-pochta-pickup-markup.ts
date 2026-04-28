// One-off: добавить настройки и наценки для Pochta после фикса
// «доставка до двери = до отделения».
//
// Что делает:
// 1) Создаёт DeliverySetting `pochta_door_surcharge` (default 300) — надбавка
//    к варианту «до двери», т.к. Pochta tariff API возвращает только цену
//    «до отделения». Идемпотентно: если ключ уже есть — не трогаем.
// 2) Создаёт DeliveryMarkupRule «Pochta — забор курьером (паритет с СДЭК)»:
//    fixed +300 ₽ на все Pochta-тарифы. Идемпотентно: ищем по name,
//    если уже есть — не дублируем.
//
// Usage: npx tsx scripts/migrate-pochta-pickup-markup.ts

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const PICKUP_RULE_NAME = "Pochta — забор курьером (паритет с СДЭК)"

async function main() {
  console.log("Pochta surcharges + pickup markup migration...")

  // 1) Setting: pochta_door_surcharge
  const existingSetting = await prisma.deliverySetting.findUnique({
    where: { key: "pochta_door_surcharge" },
  })
  if (!existingSetting) {
    await prisma.deliverySetting.create({
      data: { key: "pochta_door_surcharge", value: "300" },
    })
    console.log("  + created pochta_door_surcharge = 300")
  } else {
    console.log(`  = kept pochta_door_surcharge = "${existingSetting.value}"`)
  }

  // 2) Markup rule: фикс +300 на Pochta
  const existingRule = await prisma.deliveryMarkupRule.findFirst({
    where: { name: PICKUP_RULE_NAME },
  })
  if (!existingRule) {
    const created = await prisma.deliveryMarkupRule.create({
      data: {
        name: PICKUP_RULE_NAME,
        carrier: "pochta",
        type: "fixed",
        value: 300,
        isActive: true,
        sortOrder: 0,
      },
    })
    console.log(`  + created markup rule "${created.name}" (+300 ₽ fixed, pochta)`)
  } else {
    console.log(`  = kept markup rule "${existingRule.name}" (id=${existingRule.id})`)
  }

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
