import "dotenv/config"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const productUpdates = [
  {
    slug: "brazil-santos",
    description: "Балансный кофе с нотками жареных орехов, натурального какао и карамели. Подходит для заваривания в чашке, турке, гейзерной кофеварке и кофемашине. Идеально для молочных напитков.",
    flavorNotes: ["Жареные орехи", "Какао", "Карамель"],
    processingMethod: "Натуральная",
    brewingMethods: ["espresso", "filter", "french-press", "turka"],
    acidity: 25,
    sweetness: 65,
    bitterness: 35,
    body: 70,
    badge: "Распродажа",
    variants: [
      { weight: "250г", price: 460, oldPrice: 530, stock: 100 },
      { weight: "1кг", price: 1800, oldPrice: 2000, stock: 100 },
    ],
    reviews: [
      { name: "Gaf", rating: 5, text: "Подходит для любителей мягкого кофе без кислинки.", date: "Ноябрь 2024" },
      { name: "Виктория", rating: 5, text: "Очень понравился, беру постоянно. Очень выгодные цены и быстрая доставка!", date: "Ноябрь 2024" },
      { name: "Татьяна", rating: 5, text: "Пробовала много сортов, но этот удивил своей сбалансированностью. Нежный вкус с ореховыми нотками, идеален для френч-пресса. С удовольствием закажу снова!", date: "Ноябрь 2024" },
      { name: "Сергей", rating: 5, text: "Прекрасный кофе для тех, кто ценит классику. Чувствуется, что зерна качественные.", date: "Ноябрь 2024" },
      { name: "Максим", rating: 5, text: "Кофе очень вкусное. Ничего лишнего во вкусе, очень понравился.", date: "Ноябрь 2024" },
      { name: "Лиза", rating: 5, text: "Заказываю уже второй раз, нравится его мягкость и легкие ореховые нотки.", date: "Ноябрь 2024" },
      { name: "Глеб", rating: 5, text: "Нормальный кофе не кислый.", date: "Ноябрь 2024" },
      { name: "Женя", rating: 4, text: "Завариваю в кофемашине, вкус мягкий, без горечи, но мне немного не хватает насыщенности.", date: "Ноябрь 2024" },
      { name: "Alex325", rating: 5, text: "Постоянно заказываю Бразильский, идеальный вкус у него, не надоедает.", date: "Декабрь 2024" },
      { name: "fu4u", rating: 5, text: "База", date: "Декабрь 2024" },
      { name: "Павел", rating: 5, text: "Любимое зерно", date: "Декабрь 2024" },
      { name: "Анатолий", rating: 5, text: "Приехал быстро и в целости, не к чему придраться, свежий.", date: "Декабрь 2024" },
      { name: "Влад", rating: 4, text: "Пойдет", date: "Декабрь 2024" },
      { name: "Илья", rating: 4, text: "Люблю с кислинкой", date: "Декабрь 2024" },
      { name: "Татьяна", rating: 5, text: "Кофе быстро доехал, первой свежести, очень вкусный спасибо!", date: "Декабрь 2024" },
      { name: "Дмитрий", rating: 5, text: "Соотношения цена/качество на высшем уровне, доставили первой свежести!", date: "Декабрь 2024" },
      { name: "Крис", rating: 5, text: "Нежный, приятный вкус", date: "Декабрь 2024" },
      { name: "Юра", rating: 5, text: "Сантос — мой фаворит!", date: "Январь 2025" },
      { name: "Артур", rating: 5, text: "Очень вкусный кофе спасибо!", date: "Январь 2025" },
      { name: "Лиза", rating: 5, text: "Лучший бразильский среди всех!", date: "Февраль 2025" },
      { name: "Людмила", rating: 5, text: "Вкусный и свежий кофе, доставили очень быстро.", date: "Февраль 2025" },
      { name: "bredotec", rating: 5, text: "Просто кайф", date: "Февраль 2025" },
      { name: "Дима", rating: 5, text: "Идеальное соотношение цены и качества!", date: "Июнь 2025" },
    ],
  },
  {
    slug: "peru-gr1",
    description: "Сладкий кофе с нотками натурального какао, трубчатого табака, карамели и красного яблока. Подходит для заваривания в чашке, турке, гейзерной кофеварке и кофемашине. Идеально для молочных напитков.",
    flavorNotes: ["Какао", "Табак", "Карамель", "Красное яблоко"],
    processingMethod: "Мытая",
    brewingMethods: ["espresso", "filter", "french-press", "turka"],
    acidity: 40,
    sweetness: 70,
    bitterness: 30,
    body: 55,
    badge: "Распродажа",
    variants: [
      { weight: "250г", price: 550, oldPrice: 580, stock: 100 },
    ],
    reviews: [
      { name: "Milana", rating: 5, text: "С легкой сладостью на послевкусии, очень понравился", date: "Ноябрь 2024" },
      { name: "Ruslan", rating: 5, text: "Прекрасный кофе с ним все хорошо. Не к чему придраться!", date: "Декабрь 2024" },
      { name: "Oleg", rating: 5, text: "Хорошо", date: "Декабрь 2024" },
      { name: "Nurlan", rating: 5, text: "Хороший кофе, спасибо за качественную доставку!", date: "Декабрь 2024" },
      { name: "Alexandra", rating: 5, text: "Приятный вкус и аромат, кофе первой свежести", date: "Январь 2025" },
      { name: "Elena", rating: 5, text: "Лучший кофе из того что я пробовала. Великолепный аромат, умеренная кислинка и горечь. Правду сказал работник кофейни: кто пробовал кофе от millor потом наврятли от него откажется. После подорожания решила найти похожий аналог подешевле. Увы и ах нет такого кофе. Как говорят за удовольствие надо платить. И я так думаю что тоже вернусь в этот магазин…", date: "Март 2025" },
      { name: "Maxim", rating: 5, text: "Прекрасно раскрывается в эспрессо", date: "Май 2025" },
      { name: "Vitaly", rating: 5, text: "Ауенный кофе))", date: "Июль 2025" },
      { name: "Valery", rating: 5, text: "Приятный, запоминающийся вкус. Перепробовал все, представленные в Миллор варианты. Этот понравился больше других. Время от времени, когда тянет на что-то покрепче, череду его с кофе из Сальвадора. Чтобы оценить вкус кофе из разных стран регулярно посещаю магазин на ул. Правды, чтобы взять coffe to go.", date: "Июль 2025" },
    ],
  },
  {
    slug: "brazil-yellow-bourbon",
    description: "Во вкусе кофе ореховые ноты и молочный шоколад. Кислотность зеленого яблока. Подходит для заваривания в чашке, турке, гейзерной кофеварке и кофемашине.",
    flavorNotes: ["Молочный шоколад", "Орехи", "Зелёное яблоко"],
    processingMethod: "Мытая",
    brewingMethods: ["espresso", "french-press", "turka"],
    acidity: 55,
    sweetness: 80,
    bitterness: 25,
    body: 75,
    badge: "Распродажа",
    variants: [
      { weight: "1кг", price: 2000, oldPrice: 2200, stock: 100 },
    ],
    reviews: [
      { name: "Дмитрий", rating: 5, text: "Хороший кофе!", date: "Декабрь 2024" },
      { name: "Екатерина", rating: 5, text: "Быстро доставили, кофе доехал первой свежести, спасибо!", date: "Декабрь 2024" },
      { name: "Никита", rating: 5, text: "Сразу по запаху понял, что качественный продукт.", date: "Декабрь 2024" },
      { name: "Сергей", rating: 5, text: "На Вьетнамский очень похож, вкусный.", date: "Декабрь 2024" },
      { name: "Артур", rating: 5, text: "Хороший базовый вкус без лишней кислинки", date: "Январь 2025" },
      { name: "Виктор", rating: 5, text: "Отличный кофе, скромная цена за такое качество!", date: "Февраль 2025" },
      { name: "Вася", rating: 5, text: "Выпил — и на работу уже не так грустно идти.", date: "Май 2025" },
      { name: "Иван", rating: 5, text: "Лучшая бразилия из тех что пробовал", date: "Июль 2025" },
    ],
  },
]

async function main() {
  for (const data of productUpdates) {
    const product = await prisma.product.findFirst({ where: { slug: data.slug } })
    if (!product) {
      console.log(`Product ${data.slug} not found, skipping`)
      continue
    }

    // Update product fields
    await prisma.product.update({
      where: { id: product.id },
      data: {
        description: data.description,
        flavorNotes: data.flavorNotes,
        processingMethod: data.processingMethod,
        brewingMethods: data.brewingMethods,
        acidity: data.acidity,
        sweetness: data.sweetness,
        bitterness: data.bitterness,
        body: data.body,
        badge: data.badge,
      },
    })
    console.log(`Updated product: ${data.slug}`)

    // Update variants (prices + oldPrice)
    for (const v of data.variants) {
      const existing = await prisma.productVariant.findFirst({
        where: { productId: product.id, weight: v.weight },
      })
      if (existing) {
        await prisma.productVariant.update({
          where: { id: existing.id },
          data: { price: v.price, oldPrice: v.oldPrice, stock: v.stock },
        })
        console.log(`  Updated variant: ${v.weight} → ${v.price}₽ (was ${v.oldPrice}₽)`)
      } else {
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            weight: v.weight,
            price: v.price,
            oldPrice: v.oldPrice,
            stock: v.stock,
            sortOrder: v.weight === "1кг" ? 1 : 0,
          },
        })
        console.log(`  Created variant: ${v.weight} → ${v.price}₽`)
      }
    }

    // Delete old reviews and insert new ones
    await prisma.review.deleteMany({ where: { productId: product.id } })
    console.log(`  Deleted old reviews`)

    await prisma.review.createMany({
      data: data.reviews.map((r) => ({
        productId: product.id,
        name: r.name,
        rating: r.rating,
        text: r.text,
        date: r.date,
        isVisible: true,
      })),
    })
    console.log(`  Inserted ${data.reviews.length} reviews`)
  }

  console.log("\nDone!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
