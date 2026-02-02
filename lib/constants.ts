export const SHOP_URL = "https://millor-shop.ru"
export const CATALOG_URL = "https://millor-shop.ru/product/svezheobzharennyj-kofe/"

export const products = [
  {
    id: 1,
    name: "Peru GR1",
    description: "Яркий вкус с нотами шоколада, карамели и лёгкой цитрусовой кислинкой",
    price: 2000,
    oldPrice: 2200,
    weight: "1 кг",
    origin: "Перу",
    roast: "Средняя",
    image: "/images/peru.webp",
    url: `${SHOP_URL}/product/peru-gr1/`,
    rating: 5,
    reviews: 24,
    badge: "Хит продаж",
  },
  {
    id: 2,
    name: "Brazil Yellow Bourbon",
    description: "Сладкий вкус с нотами молочного шоколада, орехов и карамели",
    price: 2000,
    oldPrice: 2200,
    weight: "1 кг",
    origin: "Бразилия",
    roast: "Средняя",
    image: "/images/bourbon.webp",
    url: `${SHOP_URL}/product/brazil-yellow-bourbon/`,
    rating: 5,
    reviews: 31,
    badge: "Премиум",
  },
  {
    id: 3,
    name: "Brazil Santos",
    description: "Мягкий сбалансированный вкус с нотами какао и лёгкой ореховой сладостью",
    price: 1900,
    oldPrice: 2000,
    weight: "1 кг",
    origin: "Бразилия",
    roast: "Средняя",
    image: "/images/santos.webp",
    url: `${SHOP_URL}/product/brazil-santos/`,
    rating: 5,
    reviews: 18,
    badge: "Классика",
  },
]

export const features = [
  {
    title: "Свежая обжарка",
    description: "Обжариваем кофе под ваш заказ. Вы получаете свежайшее зерно для идеального утра дома.",
    icon: "Flame",
  },
  {
    title: "Отборное зерно",
    description: "Отбираем лучшие зёрна с плантаций специально для вас. 100% арабика премиум-класса.",
    icon: "Award",
  },
  {
    title: "Быстрая доставка",
    description: "Отправляем на следующий день после обжарки. Доставка до двери по всей России.",
    icon: "Truck",
  },
  {
    title: "Бесплатно от 3000₽",
    description: "Бесплатная доставка при заказе от 3000 рублей.",
    icon: "Gift",
  },
]

export const testimonials = [
  {
    name: "Алексей М.",
    text: "Наконец-то нашёл свой идеальный кофе! Peru GR1 — просто космос. Заказываю уже третий раз.",
    rating: 5,
    date: "Ноябрь 2025",
  },
  {
    name: "Мария К.",
    text: "Brazil Bourbon — это любовь с первого глотка. Потрясающие шоколадные ноты!",
    rating: 5,
    date: "Декабрь 2025",
  },
  {
    name: "Дмитрий В.",
    text: "Отличное качество, быстрая доставка. Brazil Santos идеально подходит для утреннего кофе.",
    rating: 5,
    date: "Январь 2026",
  },
]

export const navigation = [
  { name: "Преимущества", href: "#features" },
  { name: "Каталог", href: "#products" },
  { name: "О нас", href: "#about" },
  { name: "Отзывы", href: "#testimonials" },
]
