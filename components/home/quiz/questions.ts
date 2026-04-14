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
    subtitle: "Так мы подберём помол и профиль",
    options: [
      { id: "espresso", label: "Эспрессо-машина", iconSrc: "/images/brewing/ecspresso.svg" },
      { id: "filter", label: "Воронка / фильтр", iconSrc: "/images/brewing/voronka.svg" },
      { id: "turka", label: "Турка", iconSrc: "/images/brewing/tyrka.svg" },
      { id: "french-press", label: "Френч-пресс", iconSrc: "/images/brewing/french.svg" },
      { id: "moka", label: "Мока-гейзер", iconSrc: "/images/brewing/moka.svg" },
      { id: "aeropress", label: "Аэропресс", iconSrc: "/images/brewing/aero.svg" },
      { id: "any", label: "Ещё не решил", hint: "Покажем универсальные сорта" },
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
      { id: "any", label: "Пока не знаю", hint: "Подберём сбалансированный вкус" },
    ],
  },
  {
    id: "strength",
    title: "Какая крепость нужна?",
    options: [
      { id: "light", label: "Помягче", hint: "Светлая или средняя обжарка" },
      { id: "medium", label: "Сбалансированно", hint: "Классическая средняя обжарка" },
      { id: "strong", label: "Крепкий насыщенный", hint: "Тёмная обжарка, плотное тело" },
    ],
  },
  {
    id: "acidity",
    title: "Как вы относитесь к кислинке?",
    options: [
      { id: "low", label: "Минимум кислинки" },
      { id: "mid", label: "Средняя" },
      { id: "high", label: "Люблю яркую кислотность" },
    ],
  },
  {
    id: "budget",
    title: "Какой бюджет за упаковку?",
    options: [
      { id: "low", label: "До 1500 ₽", hint: "Базовая линейка" },
      { id: "mid", label: "1500–2500 ₽", hint: "Спешелти" },
      { id: "any", label: "Не важно", hint: "Покажем лучшее из подходящего" },
    ],
  },
]

export type Answers = Partial<Record<QuizQuestion["id"], AnswerId>>
