export type AnswerId = string

export interface QuizOption {
  id: AnswerId
  label: string
  hint?: string
  iconSrc?: string
}

export interface QuizQuestion {
  id: "brewing" | "flavor" | "strength" | "acidity" | "budget"
  title: string
  subtitle?: string
  options: QuizOption[]
}

export const questions: QuizQuestion[] = [
  {
    id: "brewing",
    title: "Как вы обычно завариваете кофе?",
    subtitle: "Так мы подберём подходящий профиль зерна",
    options: [
      { id: "espresso", label: "Эспрессо-машина", iconSrc: "/images/brewing/ecspresso.svg" },
      { id: "filter", label: "Воронка / фильтр", iconSrc: "/images/brewing/voronka.svg" },
      { id: "turka", label: "Турка", iconSrc: "/images/brewing/tyrka.svg" },
      { id: "french-press", label: "Френч-пресс", iconSrc: "/images/brewing/french.svg" },
      { id: "moka", label: "Мока-гейзер", iconSrc: "/images/brewing/moka.svg" },
      { id: "aeropress", label: "Аэропресс", iconSrc: "/images/brewing/aero.svg" },
      { id: "any", label: "Не важно", hint: "Покажем универсальные сорта" },
    ],
  },
  {
    id: "flavor",
    title: "Какой вкусовой профиль ближе?",
    subtitle: "Выберите настроение чашки",
    options: [
      { id: "sweet", label: "Сладкий, шоколадный", hint: "Какао, карамель, молочный шоколад" },
      { id: "fruity", label: "Яркий, фруктовый", hint: "Ягоды, цитрус, цветы" },
      { id: "nutty", label: "Ореховый, классический", hint: "Орех, хлеб, сухофрукты" },
      { id: "any", label: "Не важно", hint: "Подберём сбалансированный вкус" },
    ],
  },
  {
    id: "strength",
    title: "Какая интенсивность обжарки подойдёт?",
    subtitle: "Это про плотность и характер — не про кислинку",
    options: [
      { id: "light", label: "Лёгкая", hint: "Светлая обжарка, чистые фруктовые тона" },
      { id: "medium", label: "Классическая", hint: "Средняя обжарка, сбалансированное тело" },
      { id: "strong", label: "Насыщенная", hint: "Тёмная обжарка, плотное послевкусие" },
    ],
  },
  {
    id: "acidity",
    title: "Как относитесь к кислинке?",
    subtitle: "Кислинка — это свежие ягодно-цитрусовые ноты",
    options: [
      { id: "low", label: "Чем меньше, тем лучше", hint: "Сладость, шоколад, орех" },
      { id: "mid", label: "В меру", hint: "Слегка на фоне" },
      { id: "high", label: "Люблю яркую", hint: "Ягоды, лимон, цветы" },
    ],
  },
  {
    id: "budget",
    title: "Какой бюджет за пачку 250 г?",
    subtitle: "Средняя порция — 2-3 недели на одного",
    options: [
      { id: "low", label: "До 500 ₽", hint: "Базовая линейка" },
      { id: "mid", label: "500–650 ₽", hint: "Спешелти" },
      { id: "high", label: "От 650 ₽", hint: "Редкие премиум-сорта" },
      { id: "any", label: "Не важно", hint: "Покажем лучшее по подбору" },
    ],
  },
]

export type Answers = Partial<Record<QuizQuestion["id"], AnswerId>>
