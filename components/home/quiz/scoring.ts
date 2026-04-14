import type { Answers } from "./questions"

export interface ScorableProduct {
  id: string
  flavorNotes: string[]
  acidity: number | null
  sweetness: number | null
  bitterness: number | null
  body: number | null
  roastLevel: string | null
  brewingMethods: string[]
  minPrice: number | null
}

// keyword buckets for flavor matching (normalized lowercase, stem-ish)
const FLAVOR_KEYWORDS: Record<string, string[]> = {
  sweet: ["шокол", "карам", "ванил", "мёд", "мед", "ирис", "кара-мел"],
  fruity: ["ягод", "смород", "клубни", "малин", "вишн", "цитрус", "лимон", "апельс", "яблок", "абрик", "персик", "манго", "тропич", "цвет", "жасмин"],
  nutty: ["орех", "фундук", "миндал", "арахис", "какао", "хлеб", "тоффи", "сухофрукт", "изюм"],
}

function flavorMatch(target: string, notes: string[]): number {
  if (target === "any") return 12
  const keywords = FLAVOR_KEYWORDS[target]
  if (!keywords) return 10
  const normalized = notes.map((n) => n.toLowerCase())
  let hits = 0
  for (const note of normalized) {
    if (keywords.some((kw) => note.includes(kw))) hits++
  }
  if (hits === 0) return 5
  if (hits === 1) return 18
  return 25
}

function strengthMatch(target: string, roast: string | null, body: number | null): number {
  if (!roast && body === null) return 8
  const r = (roast ?? "").toLowerCase()
  const b = body ?? 50
  if (target === "light") {
    if (r.includes("светл")) return 15
    if (r.includes("сред") && b <= 55) return 12
    if (r.includes("тёмн") || r.includes("темн")) return 2
    return 8
  }
  if (target === "medium") {
    if (r.includes("сред")) return 15
    if (r.includes("светл") || r.includes("тёмн") || r.includes("темн")) return 8
    return 10
  }
  if (target === "strong") {
    if (r.includes("тёмн") || r.includes("темн")) return 15
    if (r.includes("сред") && b >= 60) return 12
    if (r.includes("светл")) return 2
    return 8
  }
  return 8
}

function acidityMatch(target: string, acidity: number | null): number {
  if (acidity === null) return 8
  if (target === "low") {
    if (acidity <= 35) return 15
    if (acidity <= 55) return 8
    return 2
  }
  if (target === "mid") {
    if (acidity >= 35 && acidity <= 65) return 15
    return 8
  }
  if (target === "high") {
    if (acidity >= 65) return 15
    if (acidity >= 50) return 10
    return 3
  }
  return 8
}

function priceMatch(target: string, minPrice: number | null): number {
  if (target === "any") return 10
  if (minPrice === null) return 8
  if (target === "low") {
    if (minPrice <= 1500) return 15
    if (minPrice <= 2000) return 10
    return 3
  }
  if (target === "mid") {
    if (minPrice >= 1500 && minPrice <= 2500) return 15
    if (minPrice <= 3000) return 10
    return 5
  }
  return 10
}

function brewingMatch(target: string, methods: string[]): number {
  if (target === "any") return 20
  if (methods.length === 0) return 15 // universal fallback
  return methods.includes(target) ? 30 : 5
}

export interface ScoredProduct {
  productId: string
  score: number // 0..100
}

export function scoreProducts(products: ScorableProduct[], answers: Answers): ScoredProduct[] {
  const brewing = answers.brewing ?? "any"
  const flavor = answers.flavor ?? "any"
  const strength = answers.strength ?? "medium"
  const acidity = answers.acidity ?? "mid"
  const budget = answers.budget ?? "any"

  return products
    .map((p) => {
      const score =
        brewingMatch(brewing, p.brewingMethods) + // 0..30
        flavorMatch(flavor, p.flavorNotes) +      // 0..25
        strengthMatch(strength, p.roastLevel, p.body) + // 0..15
        acidityMatch(acidity, p.acidity) +        // 0..15
        priceMatch(budget, p.minPrice)            // 0..15
      return { productId: p.id, score }
    })
    .sort((a, b) => b.score - a.score)
}
