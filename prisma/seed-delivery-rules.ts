import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const rules = [
  // Почта России — бесплатная доставка (самовывоз) с прогрессивным лимитом стоимости
  { name: "Бесплатная доставка от 3000₽", carrier: "pochta", deliveryType: "pvz", minCartTotal: 3000, maxDeliveryPrice: 750, action: "free", sortOrder: 1 },
  { name: "Бесплатная доставка от 4000₽", carrier: "pochta", deliveryType: "pvz", minCartTotal: 4000, maxDeliveryPrice: 1000, action: "free", sortOrder: 2 },
  { name: "Бесплатная доставка от 5000₽", carrier: "pochta", deliveryType: "pvz", minCartTotal: 5000, maxDeliveryPrice: 1100, action: "free", sortOrder: 3 },
  { name: "Бесплатная доставка от 7000₽", carrier: "pochta", deliveryType: "pvz", minCartTotal: 7000, maxDeliveryPrice: 1400, action: "free", sortOrder: 4 },
  { name: "Бесплатная доставка от 10000₽", carrier: "pochta", deliveryType: "pvz", minCartTotal: 10000, maxDeliveryPrice: 1700, action: "free", sortOrder: 5 },
  { name: "Бесплатная доставка от 15000₽", carrier: "pochta", deliveryType: "pvz", minCartTotal: 15000, maxDeliveryPrice: 2000, action: "free", sortOrder: 6 },
  { name: "Бесплатная доставка от 25000₽", carrier: "pochta", deliveryType: "pvz", minCartTotal: 25000, maxDeliveryPrice: 3000, action: "free", sortOrder: 7 },
  { name: "Бесплатная доставка от 50000₽", carrier: "pochta", deliveryType: "pvz", minCartTotal: 50000, maxDeliveryPrice: 4000, action: "free", sortOrder: 8 },
  // Почта России — отключить в Калининграде (город отправки = Калининград, бессмысленно)
  { name: "Выкл. в Калининграде", carrier: "pochta", city: "Калининград", action: "disable", sortOrder: 0 },
]

async function main() {
  console.log("Seeding delivery rules...")

  for (const rule of rules) {
    await prisma.deliveryRule.create({
      data: {
        name: rule.name,
        carrier: rule.carrier,
        deliveryType: rule.deliveryType || null,
        minCartTotal: rule.minCartTotal || null,
        maxDeliveryPrice: rule.maxDeliveryPrice || null,
        city: rule.city || null,
        action: rule.action,
        discountAmount: null,
        isActive: true,
        sortOrder: rule.sortOrder,
      },
    })
    console.log(`  ✓ ${rule.name}`)
  }

  console.log("Done!")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
