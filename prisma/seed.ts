import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // Create admin user — password MUST be set via environment variable
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD env variable is required for seeding. Example: ADMIN_PASSWORD=your-secure-password npx tsx prisma/seed.ts")
  }
  const adminEmail = process.env.ADMIN_EMAIL || "admin@millor-coffee.ru"
  const passwordHash = await bcrypt.hash(adminPassword, 12)
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: "Администратор",
      role: "superadmin",
    },
  })

  // Create category
  const coffeeCategory = await prisma.category.upsert({
    where: { slug: "zernovoy-kofe" },
    update: {},
    create: {
      name: "Зерновой кофе",
      slug: "zernovoy-kofe",
      description: "Свежеобжаренный кофе в зёрнах из лучших плантаций мира",
      sortOrder: 1,
      isActive: true,
    },
  })

  // Create additional categories
  await prisma.category.upsert({
    where: { slug: "chay" },
    update: {},
    create: {
      name: "Чай",
      slug: "chay",
      description: "Листовой чай из лучших чайных плантаций",
      sortOrder: 2,
      isActive: true,
    },
  })

  await prisma.category.upsert({
    where: { slug: "rastvorimaya-produkciya" },
    update: {},
    create: {
      name: "Растворимая продукция",
      slug: "rastvorimaya-produkciya",
      description: "Растворимые напитки для быстрого приготовления",
      sortOrder: 3,
      isActive: true,
    },
  })

  await prisma.category.upsert({
    where: { slug: "zdorovoe-pitanie" },
    update: {},
    create: {
      name: "Здоровое питание",
      slug: "zdorovoe-pitanie",
      description: "Суперфуды и полезные продукты для здорового образа жизни",
      sortOrder: 4,
      isActive: true,
    },
  })

  // Tea subcategories
  const chayCategory = await prisma.category.findUnique({ where: { slug: "chay" } })
  if (chayCategory) {
    const teaSubcats = [
      { name: "Чёрный чай", slug: "cherniy-chay", sortOrder: 1 },
      { name: "Зелёный чай", slug: "zelenyy-chay", sortOrder: 2 },
      { name: "Улун", slug: "ulon", sortOrder: 3 },
      { name: "Иван-чай", slug: "ivan-chay", sortOrder: 4 },
      { name: "Матча", slug: "matcha", sortOrder: 5 },
      { name: "Пуэр", slug: "puer", sortOrder: 6 },
    ]
    for (const sub of teaSubcats) {
      await prisma.category.upsert({
        where: { slug: sub.slug },
        update: {},
        create: { ...sub, parentId: chayCategory.id, isActive: true },
      })
    }
  }

  // Instant subcategories
  const instantCategory = await prisma.category.findUnique({ where: { slug: "rastvorimaya-produkciya" } })
  if (instantCategory) {
    const instantSubcats = [
      { name: "Цикорий", slug: "cicory", sortOrder: 1 },
      { name: "Растворимый кофе", slug: "instant-coffee", sortOrder: 2 },
    ]
    for (const sub of instantSubcats) {
      await prisma.category.upsert({
        where: { slug: sub.slug },
        update: {},
        create: { ...sub, parentId: instantCategory.id, isActive: true },
      })
    }
  }

  // Seed products
  const productsData = [
    {
      name: "Peru GR1",
      slug: "peru-gr1",
      description: "Яркий вкус с нотами шоколада, карамели и лёгкой цитрусовой кислинкой",
      fullDescription:
        "Peru GR1 — это превосходный кофе из высокогорных регионов Перу. Зёрна выращиваются на высоте 1200-1800 метров над уровнем моря, что придаёт им уникальный вкусовой профиль. При средней обжарке раскрываются ноты молочного шоколада и карамели с приятной цитрусовой кислинкой в послевкусии. Идеальный выбор для тех, кто ценит баланс во вкусе.",
      origin: "Перу",
      region: "Cajamarca",
      altitude: "1200-1800м",
      roastLevel: "Средняя",
      processingMethod: "Мытая",
      flavorNotes: ["Шоколад", "Карамель", "Цитрус"],
      acidity: 55,
      sweetness: 70,
      bitterness: 30,
      body: 65,
      brewingMethods: ["espresso", "filter", "french-press", "turka"],
      badge: "Хит продаж",
      isFeatured: true,
      sortOrder: 1,
      images: [{ url: "/images/peru.webp", alt: "Peru GR1", isPrimary: true, sortOrder: 0 }],
      variants: [
        { weight: "250г", price: 600, oldPrice: 650, stock: 100, sortOrder: 0 },
        { weight: "1кг", price: 2000, oldPrice: 2200, stock: 100, sortOrder: 1 },
      ],
      reviews: [
        {
          name: "Алексей М.",
          text: "Наконец-то нашёл свой идеальный кофе! Peru GR1 — просто космос. Заказываю уже третий раз.",
          rating: 5,
          date: "Ноябрь 2025",
        },
      ],
    },
    {
      name: "Brazil Yellow Bourbon",
      slug: "brazil-yellow-bourbon",
      description: "Сладкий вкус с нотами молочного шоколада, орехов и карамели",
      fullDescription:
        "Brazil Yellow Bourbon — это премиальный сорт бразильского кофе, выращенный на плантациях региона Суль-де-Минас. Разновидность Yellow Bourbon отличается жёлтыми, а не красными ягодами, что придаёт зёрнам исключительную сладость. При средней обжарке раскрывается богатый букет с доминирующими нотами молочного шоколада, фундука и мягкой карамели.",
      origin: "Бразилия",
      region: "Sul de Minas",
      altitude: "1000-1400м",
      roastLevel: "Средняя",
      processingMethod: "Натуральная",
      flavorNotes: ["Молочный шоколад", "Орехи", "Карамель"],
      acidity: 35,
      sweetness: 80,
      bitterness: 25,
      body: 75,
      brewingMethods: ["espresso", "french-press", "turka"],
      badge: "Премиум",
      isFeatured: true,
      sortOrder: 2,
      images: [{ url: "/images/bourbon.webp", alt: "Brazil Yellow Bourbon", isPrimary: true, sortOrder: 0 }],
      variants: [
        { weight: "250г", price: 600, oldPrice: 650, stock: 100, sortOrder: 0 },
        { weight: "1кг", price: 2000, oldPrice: 2200, stock: 100, sortOrder: 1 },
      ],
      reviews: [
        {
          name: "Мария К.",
          text: "Brazil Bourbon — это любовь с первого глотка. Потрясающие шоколадные ноты!",
          rating: 5,
          date: "Декабрь 2025",
        },
      ],
    },
    {
      name: "Brazil Santos",
      slug: "brazil-santos",
      description: "Мягкий сбалансированный вкус с нотами какао и лёгкой ореховой сладостью",
      fullDescription:
        "Brazil Santos — классический бразильский кофе, названный в честь порта Сантос, через который экспортировалось большинство бразильского кофе. Этот сорт отличается мягким, сбалансированным вкусом с низкой кислотностью. Идеален как для чёрного кофе, так и для приготовления с молоком. Ноты какао и орехов делают его универсальным выбором на каждый день.",
      origin: "Бразилия",
      region: "Santos",
      altitude: "800-1200м",
      roastLevel: "Средняя",
      processingMethod: "Натуральная",
      flavorNotes: ["Какао", "Орехи", "Сладость"],
      acidity: 25,
      sweetness: 65,
      bitterness: 35,
      body: 70,
      brewingMethods: ["espresso", "filter", "french-press", "turka"],
      badge: "Классика",
      isFeatured: true,
      sortOrder: 3,
      images: [{ url: "/images/santos.webp", alt: "Brazil Santos", isPrimary: true, sortOrder: 0 }],
      variants: [
        { weight: "250г", price: 550, oldPrice: 600, stock: 100, sortOrder: 0 },
        { weight: "1кг", price: 1900, oldPrice: 2000, stock: 100, sortOrder: 1 },
      ],
      reviews: [
        {
          name: "Дмитрий В.",
          text: "Отличное качество, быстрая доставка. Brazil Santos идеально подходит для утреннего кофе.",
          rating: 5,
          date: "Январь 2026",
        },
      ],
    },
  ]

  for (const data of productsData) {
    const { images, variants, reviews, ...productData } = data

    const product = await prisma.product.upsert({
      where: { slug: productData.slug },
      update: {},
      create: {
        ...productData,
        categoryId: coffeeCategory.id,
      },
    })

    // Create images
    const existingImages = await prisma.productImage.count({ where: { productId: product.id } })
    if (existingImages === 0) {
      await prisma.productImage.createMany({
        data: images.map((img) => ({ ...img, productId: product.id })),
      })
    }

    // Create variants
    const existingVariants = await prisma.productVariant.count({ where: { productId: product.id } })
    if (existingVariants === 0) {
      await prisma.productVariant.createMany({
        data: variants.map((v) => ({ ...v, productId: product.id })),
      })
    }

    // Create reviews
    const existingReviews = await prisma.review.count({ where: { productId: product.id } })
    if (existingReviews === 0) {
      await prisma.review.createMany({
        data: reviews.map((r) => ({ ...r, productId: product.id })),
      })
    }
  }

  // Seed default delivery settings
  const deliveryDefaults: Record<string, string> = {
    // Sender
    sender_city: "",
    sender_city_code: "",
    sender_postal_code: "",
    // Package fallback (для старых путей расчёта) — используется когда в корзине нет items
    default_weight_grams: "300",
    default_length_cm: "20",
    default_width_cm: "15",
    default_height_cm: "10",
    // Box presets — физические коробки, используемые для упаковки.
    // Редактируются в админке, алгоритм planPackages выбирает подходящую.
    box_presets: JSON.stringify([
      { code: "S", name: "Маленькая 20×20×20", length: 20, width: 20, height: 20, tareGrams: 150, maxWeightGrams: 2500, maxUnits: 8 },
      { code: "M", name: "Средняя 31×23×20",   length: 31, width: 23, height: 20, tareGrams: 220, maxWeightGrams: 4500, maxUnits: 14 },
      { code: "L", name: "Большая 39×26×21",   length: 39, width: 26, height: 21, tareGrams: 300, maxWeightGrams: 7500, maxUnits: 23 },
    ]),
    // Free delivery threshold
    free_delivery_threshold: "3000",
    // CDEK
    cdek_enabled: "false",
    cdek_client_id: "",
    cdek_client_secret: "",
    cdek_test_mode: "true",
    // Все тарифы — «дверь-...»: CDEK-курьер забирает посылку у нас (door pickup),
    // а не мы везём её на склад СДЭК. Покупателю показываем 4 опции:
    // эконом до двери / эконом в ПВЗ / посылка до двери / посылка в ПВЗ.
    cdek_tariffs: JSON.stringify([231, 232, 138, 139]),
    // Pochta RF — enabled by default (tariff API works without tokens)
    pochta_enabled: "true",
    pochta_access_token: "",
    pochta_user_auth: "",
    pochta_object_type: "47030",
    // Pochta tariff API возвращает цену «до отделения». Доставка курьером на дом
    // оплачивается отдельно — добавляем фикс. надбавку на «до двери» вариант.
    pochta_door_surcharge: "300",
    // Local courier
    courier_enabled: "true",
    courier_price: "300",
    courier_city: "Калининград",
    courier_free_threshold: "3000",
    // Yandex Maps (for ПВЗ map visualization)
    yandex_maps_api_key: "",
    // DaData — primary address autocomplete + geocoding (free tier: 10k/day)
    dadata_api_key: "",
    // Cart upsell / gift threshold
    gift_threshold: "5000",
    gift_description: "Подарок от нас",
  }

  for (const [key, value] of Object.entries(deliveryDefaults)) {
    await prisma.deliverySetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    })
  }

  console.log("Seed completed successfully!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
