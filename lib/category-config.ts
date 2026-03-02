// Declarative config for category-specific form fields, templates, and options

export type FieldSection =
  | "origin"
  | "region"
  | "farm"
  | "altitude"
  | "roastLevel"
  | "processingMethod"
  | "flavorNotes"
  | "flavorProfile"
  | "brewingMethods"

const ALL_COFFEE_FIELDS: FieldSection[] = [
  "origin",
  "region",
  "farm",
  "altitude",
  "roastLevel",
  "processingMethod",
  "flavorNotes",
  "flavorProfile",
  "brewingMethods",
]

const TEA_FIELDS: FieldSection[] = [
  "origin",
  "region",
  "flavorNotes",
  "brewingMethods",
]

const CATEGORY_FIELD_CONFIG: Record<string, FieldSection[]> = {
  "zernovoy-kofe": ALL_COFFEE_FIELDS,
  chay: TEA_FIELDS,
  "rastvorimaya-produkciya": [],
  "zdorovoe-pitanie": [],
  _default: ALL_COFFEE_FIELDS,
}

export const BREWING_OPTIONS_BY_CATEGORY: Record<
  string,
  { value: string; label: string }[]
> = {
  "zernovoy-kofe": [
    { value: "espresso", label: "Эспрессо" },
    { value: "filter", label: "Фильтр" },
    { value: "french-press", label: "Френч-пресс" },
    { value: "turka", label: "Турка" },
    { value: "aeropress", label: "Аэропресс" },
    { value: "moka", label: "Мока" },
  ],
  chay: [
    { value: "teapot", label: "Чайник" },
    { value: "gaiwan", label: "Гайвань" },
    { value: "french-press", label: "Френч-пресс" },
    { value: "samovar", label: "Самовар" },
  ],
  _default: [
    { value: "espresso", label: "Эспрессо" },
    { value: "filter", label: "Фильтр" },
    { value: "french-press", label: "Френч-пресс" },
    { value: "turka", label: "Турка" },
    { value: "aeropress", label: "Аэропресс" },
    { value: "moka", label: "Мока" },
  ],
}

export const WEIGHT_OPTIONS_BY_CATEGORY: Record<string, string[]> = {
  "zernovoy-kofe": ["250г", "1кг"],
  chay: ["50г", "100г", "250г"],
  "zdorovoe-pitanie": ["250г", "500г", "1кг"],
  _default: ["250г", "500г", "1кг"],
}

export interface CategoryTemplate {
  id: string
  label: string
  name: string
  description: string
  attributes: {
    origin?: string
    region?: string
    farm?: string
    altitude?: string
    roastLevel?: string
    processingMethod?: string
    flavorNotes?: string
    acidity?: number
    sweetness?: number
    bitterness?: number
    body?: number
    brewingMethods?: string[]
  }
  variants: { weight: string; price: number; oldPrice?: number; stock: number }[]
}

export const CATEGORY_TEMPLATES: Record<string, CategoryTemplate[]> = {
  "zernovoy-kofe": [
    {
      id: "arabica-ethiopia",
      label: "Арабика Эфиопия",
      name: "Эфиопия",
      description: "Яркий фруктовый вкус с цветочными нотами и цитрусовой кислинкой",
      attributes: {
        origin: "Эфиопия",
        region: "Yirgacheffe",
        altitude: "1800-2200м",
        roastLevel: "Светлая",
        processingMethod: "Мытая",
        flavorNotes: "Цитрус, Жасмин, Бергамот",
        acidity: 75,
        sweetness: 65,
        bitterness: 15,
        body: 45,
        brewingMethods: ["filter", "aeropress"],
      },
      variants: [
        { weight: "250г", price: 700, stock: 50 },
        { weight: "1кг", price: 2400, stock: 30 },
      ],
    },
    {
      id: "robusta-vietnam",
      label: "Робуста Вьетнам",
      name: "Вьетнам Робуста",
      description: "Крепкий насыщенный вкус с нотами тёмного шоколада и орехов",
      attributes: {
        origin: "Вьетнам",
        region: "Central Highlands",
        altitude: "500-800м",
        roastLevel: "Тёмная",
        processingMethod: "Натуральная",
        flavorNotes: "Тёмный шоколад, Орехи, Табак",
        acidity: 15,
        sweetness: 30,
        bitterness: 80,
        body: 90,
        brewingMethods: ["espresso", "turka", "moka"],
      },
      variants: [
        { weight: "250г", price: 400, stock: 100 },
        { weight: "1кг", price: 1400, stock: 50 },
      ],
    },
    {
      id: "brazil-classic",
      label: "Бразилия классика",
      name: "Бразилия",
      description: "Мягкий сбалансированный вкус с нотами шоколада и карамели",
      attributes: {
        origin: "Бразилия",
        region: "Sul de Minas",
        altitude: "1000-1400м",
        roastLevel: "Средняя",
        processingMethod: "Натуральная",
        flavorNotes: "Шоколад, Карамель, Орехи",
        acidity: 30,
        sweetness: 70,
        bitterness: 35,
        body: 70,
        brewingMethods: ["espresso", "french-press", "turka"],
      },
      variants: [
        { weight: "250г", price: 550, stock: 100 },
        { weight: "1кг", price: 1900, stock: 50 },
      ],
    },
  ],
  chay: [
    {
      id: "green-tea",
      label: "Зелёный чай",
      name: "Зелёный чай",
      description: "Лёгкий освежающий вкус с травяными нотами",
      attributes: {
        origin: "Китай",
        region: "Чжэцзян",
        flavorNotes: "Трава, Жасмин, Свежесть",
        brewingMethods: ["teapot", "gaiwan"],
      },
      variants: [
        { weight: "50г", price: 350, stock: 50 },
        { weight: "100г", price: 600, stock: 30 },
      ],
    },
    {
      id: "black-tea",
      label: "Чёрный чай",
      name: "Чёрный чай",
      description: "Насыщенный крепкий вкус с медовыми нотами",
      attributes: {
        origin: "Индия",
        region: "Ассам",
        flavorNotes: "Мёд, Солод, Карамель",
        brewingMethods: ["teapot", "french-press"],
      },
      variants: [
        { weight: "50г", price: 300, stock: 50 },
        { weight: "100г", price: 500, stock: 30 },
      ],
    },
    {
      id: "ivan-tea",
      label: "Иван-чай",
      name: "Иван-чай",
      description: "Традиционный русский травяной чай с мягким цветочным вкусом",
      attributes: {
        origin: "Россия",
        region: "Вологодская область",
        flavorNotes: "Цветы, Мёд, Луг",
        brewingMethods: ["teapot", "french-press", "samovar"],
      },
      variants: [
        { weight: "50г", price: 250, stock: 80 },
        { weight: "100г", price: 400, stock: 40 },
      ],
    },
  ],
  "rastvorimaya-produkciya": [
    {
      id: "coffee-3in1",
      label: "Кофе 3в1",
      name: "Кофе 3в1",
      description: "Растворимый кофе с молоком и сахаром — удобно и быстро",
      attributes: {},
      variants: [
        { weight: "250г", price: 300, stock: 100 },
        { weight: "500г", price: 500, stock: 50 },
      ],
    },
    {
      id: "hot-chocolate",
      label: "Горячий шоколад",
      name: "Горячий шоколад",
      description: "Насыщенный шоколадный напиток для уютных вечеров",
      attributes: {},
      variants: [
        { weight: "250г", price: 350, stock: 80 },
        { weight: "500г", price: 600, stock: 40 },
      ],
    },
  ],
  "zdorovoe-pitanie": [
    {
      id: "superfood-mix",
      label: "Суперфуд микс",
      name: "Суперфуд микс",
      description: "Смесь суперфудов для здорового и энергичного образа жизни",
      attributes: {},
      variants: [
        { weight: "250г", price: 500, stock: 50 },
        { weight: "500г", price: 900, stock: 30 },
      ],
    },
  ],
}

// Section display title by category
const SECTION_TITLES: Record<string, string> = {
  "zernovoy-kofe": "Кофейные атрибуты",
  chay: "Чайные атрибуты",
  _default: "Атрибуты",
}

// Helpers
export function getFieldConfig(slug: string): FieldSection[] {
  return CATEGORY_FIELD_CONFIG[slug] ?? CATEGORY_FIELD_CONFIG._default
}

export function getBrewingOptions(slug: string) {
  return BREWING_OPTIONS_BY_CATEGORY[slug] ?? BREWING_OPTIONS_BY_CATEGORY._default
}

export function getWeightOptions(slug: string): string[] {
  return WEIGHT_OPTIONS_BY_CATEGORY[slug] ?? WEIGHT_OPTIONS_BY_CATEGORY._default
}

export function getTemplates(slug: string): CategoryTemplate[] {
  return CATEGORY_TEMPLATES[slug] ?? []
}

export function isSectionVisible(slug: string, section: FieldSection): boolean {
  const fields = getFieldConfig(slug)
  return fields.includes(section)
}

export function getSectionTitle(slug: string): string {
  return SECTION_TITLES[slug] ?? SECTION_TITLES._default
}
