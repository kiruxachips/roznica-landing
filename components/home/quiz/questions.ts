export type AnswerId = string

export interface QuizOption {
  id: AnswerId
  label: string
  hint?: string
  iconSrc?: string
}

export interface QuizQuestion {
  id: "milk" | "flavor" | "acidity" | "brewing" | "experience"
  title: string
  subtitle?: string
  options: QuizOption[]
}

// Questions are driven by the curated collections seeded in
// prisma/seed-collections.ts. Each answer nudges the scorer toward (or away
// from) specific collections — see ./scoring.ts.
//
// Not included on purpose:
//  - Roast level: 27 of 32 coffees are "Средняя", so the signal is nearly flat.
//  - Budget: explicit product decision — we want the quiz to match taste, not
//    push cheaper options onto people who'd love a premium sort.
export const questions: QuizQuestion[] = [
  {
    id: "milk",
    title: "Как вы обычно пьёте кофе?",
    subtitle: "Это самый важный вопрос — молоко требует совсем других зёрен, чем чёрный кофе",
    options: [
      {
        id: "milk",
        label: "С молоком",
        hint: "Латте, капучино, флэт-уайт, раф",
      },
      {
        id: "black",
        label: "Чёрный",
        hint: "Эспрессо, фильтр, американо — без молока",
      },
      {
        id: "both",
        label: "По-разному",
        hint: "Иногда с молоком, иногда без",
      },
    ],
  },
  {
    id: "flavor",
    title: "Какой вкусовой профиль ближе?",
    subtitle: "Выбирайте то настроение, которое хочется в чашке",
    options: [
      {
        id: "chocolate",
        label: "Шоколадно-ореховый",
        hint: "Какао, тёмный шоколад, жареные орехи, карамель",
      },
      {
        id: "balanced",
        label: "Классический сбалансированный",
        hint: "Мягкий универсальный вкус на каждый день",
      },
      {
        id: "fruity",
        label: "Яркий фруктово-ягодный",
        hint: "Ягоды, цитрусы, цветы, чистая чашка",
      },
      {
        id: "any",
        label: "Удивите",
        hint: "Подберём интересное под остальные ответы",
      },
    ],
  },
  {
    id: "acidity",
    title: "Как относитесь к кислинке?",
    subtitle: "Кислинка — это свежие ягодно-цитрусовые ноты. Не путать с горечью.",
    options: [
      {
        id: "low",
        label: "Не люблю",
        hint: "Мягкий вкус, сладость, шоколад",
      },
      {
        id: "mid",
        label: "В меру",
        hint: "Небольшая кислинка на фоне",
      },
      {
        id: "high",
        label: "Обожаю яркую",
        hint: "Сочные ягоды, лимон, виноград",
      },
    ],
  },
  {
    id: "brewing",
    title: "Как обычно готовите кофе дома?",
    subtitle: "Под метод заваривания подбираются разные помолы и зёрна",
    options: [
      { id: "espresso", label: "Эспрессо-машина", iconSrc: "/images/brewing/ecspresso.svg" },
      { id: "turka", label: "Турка", iconSrc: "/images/brewing/tyrka.svg" },
      { id: "filter", label: "Фильтр / Воронка / Аэропресс", iconSrc: "/images/brewing/voronka.svg" },
      { id: "french-press", label: "Френч-пресс или мока", iconSrc: "/images/brewing/french.svg" },
      { id: "any", label: "По-разному", hint: "Универсальные сорта" },
    ],
  },
  {
    id: "experience",
    title: "Какой у вас опыт с кофе?",
    subtitle: "Поможем не промахнуться — кому-то нужна надёжная классика, кому-то редкость",
    options: [
      {
        id: "beginner",
        label: "Только знакомлюсь",
        hint: "Покажем безопасные универсальные варианты",
      },
      {
        id: "regular",
        label: "Пью каждый день",
        hint: "Уже знаю свой вкус, без экспериментов",
      },
      {
        id: "enthusiast",
        label: "Ищу что-то особенное",
        hint: "Редкие регионы, сложные профили, необычные ноты",
      },
    ],
  },
]

export type Answers = Partial<Record<QuizQuestion["id"], AnswerId>>
