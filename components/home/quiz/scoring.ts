import type { Answers } from "./questions"

export interface ScorableVariant {
  weight: string
  price: number
}

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
  variants: ScorableVariant[]
}

// Flavor keyword buckets (normalized lowercase, stem-ish)
const FLAVOR_KEYWORDS: Record<string, string[]> = {
  sweet: ["шокол", "карам", "ванил", "мёд", "мед", "ирис", "тоффи", "пралине"],
  fruity: [
    "ягод", "смород", "клубни", "малин", "вишн", "слив", "черносл",
    "цитрус", "лимон", "апельс", "грейпф",
    "яблок", "абрик", "персик", "манго", "тропич", "цвет", "жасмин", "бергамот", "чай",
  ],
  nutty: ["орех", "фундук", "миндал", "арахис", "какао", "хлеб", "солод", "сухофрукт", "изюм", "табак"],
}

function findFlavorHits(target: string, notes: string[]): number {
  const keywords = FLAVOR_KEYWORDS[target] ?? []
  const normalized = notes.map((n) => n.toLowerCase())
  let hits = 0
  for (const note of normalized) {
    if (keywords.some((kw) => note.includes(kw))) hits++
  }
  return hits
}

// Convert any variant to price per 250g to normalize across different pack sizes.
function pricePer250g(variants: ScorableVariant[]): number | null {
  if (variants.length === 0) return null
  const best = variants
    .map((v) => {
      const m = v.weight.match(/(\d+)\s*(г|гр|g|кг|kg)?/i)
      if (!m) return null
      let grams = Number(m[1])
      const unit = (m[2] || "").toLowerCase()
      if (unit.startsWith("к")) grams *= 1000
      if (grams === 0) return null
      return (v.price / grams) * 250
    })
    .filter((x): x is number => x !== null)
  if (best.length === 0) return null
  return Math.round(Math.min(...best))
}

interface AxisResult {
  got: number
  max: number
}

function brewingAxis(target: string | undefined, methods: string[]): AxisResult {
  if (!target || target === "any") return { got: 0, max: 0 }
  if (methods.includes(target)) return { got: 30, max: 30 }
  if (methods.length === 0) return { got: 15, max: 30 } // universal fallback
  return { got: 0, max: 30 }
}

function flavorAxis(target: string | undefined, notes: string[]): AxisResult {
  if (!target || target === "any") return { got: 0, max: 0 }
  const hits = findFlavorHits(target, notes)
  if (hits >= 2) return { got: 25, max: 25 }
  if (hits === 1) return { got: 17, max: 25 }
  return { got: 3, max: 25 }
}

function strengthAxis(
  target: string | undefined,
  roast: string | null,
  body: number | null
): AxisResult {
  if (!target) return { got: 0, max: 0 }
  const r = (roast ?? "").toLowerCase()
  const b = body ?? 50

  if (target === "light") {
    if (r.includes("светл")) return { got: 15, max: 15 }
    if (r.includes("сред") && !r.includes("тёмн") && !r.includes("темн")) return { got: 8, max: 15 }
    if (r.includes("тёмн") || r.includes("темн")) return { got: 0, max: 15 }
    return { got: 7, max: 15 }
  }
  if (target === "medium") {
    if (r === "средняя" || (r.includes("сред") && !r.includes("тёмн") && !r.includes("темн"))) {
      return { got: 15, max: 15 }
    }
    if (r.includes("тёмн") || r.includes("темн")) return { got: 8, max: 15 }
    if (r.includes("светл")) return { got: 9, max: 15 }
    return { got: 10, max: 15 }
  }
  // strong
  if (r.includes("тёмн") || r.includes("темн")) return { got: 15, max: 15 }
  if (r.includes("сред") && b >= 55) return { got: 10, max: 15 }
  if (r.includes("светл")) return { got: 0, max: 15 }
  return { got: 7, max: 15 }
}

function acidityAxis(target: string | undefined, acidity: number | null, notes: string[]): AxisResult {
  if (!target) return { got: 0, max: 0 }

  // Proxy: if no numeric acidity metadata, infer from flavor notes.
  const hasFruity = findFlavorHits("fruity", notes) > 0
  const hasSweet = findFlavorHits("sweet", notes) > 0
  const inferred = acidity ?? (hasFruity ? 70 : hasSweet ? 35 : 50)

  if (target === "low") {
    if (inferred <= 35) return { got: 15, max: 15 }
    if (inferred <= 55) return { got: 9, max: 15 }
    return { got: 0, max: 15 }
  }
  if (target === "mid") {
    if (inferred >= 35 && inferred <= 65) return { got: 15, max: 15 }
    return { got: 8, max: 15 }
  }
  // high
  if (inferred >= 65) return { got: 15, max: 15 }
  if (inferred >= 50) return { got: 9, max: 15 }
  return { got: 0, max: 15 }
}

function priceAxis(target: string | undefined, per250g: number | null): AxisResult {
  if (!target || target === "any") return { got: 0, max: 0 }
  if (per250g === null) return { got: 7, max: 15 }

  if (target === "low") {
    if (per250g <= 500) return { got: 15, max: 15 }
    if (per250g <= 600) return { got: 8, max: 15 }
    return { got: 0, max: 15 }
  }
  if (target === "mid") {
    if (per250g >= 500 && per250g <= 650) return { got: 15, max: 15 }
    if (per250g <= 750) return { got: 9, max: 15 }
    return { got: 3, max: 15 }
  }
  // high
  if (per250g >= 650) return { got: 15, max: 15 }
  if (per250g >= 580) return { got: 9, max: 15 }
  return { got: 3, max: 15 }
}

export interface ScoredProduct {
  productId: string
  percent: number  // 0-100, relative to user's selected criteria
  raw: number
  maxPossible: number
}

export function scoreProducts(
  products: ScorableProduct[],
  answers: Answers
): ScoredProduct[] {
  return products
    .map((p) => {
      const axes = [
        brewingAxis(answers.brewing, p.brewingMethods),
        flavorAxis(answers.flavor, p.flavorNotes),
        strengthAxis(answers.strength, p.roastLevel, p.body),
        acidityAxis(answers.acidity, p.acidity, p.flavorNotes),
        priceAxis(answers.budget, pricePer250g(p.variants)),
      ]
      const raw = axes.reduce((s, a) => s + a.got, 0)
      const maxPossible = axes.reduce((s, a) => s + a.max, 0)
      const percent =
        maxPossible > 0 ? Math.round((raw / maxPossible) * 100) : 50
      return { productId: p.id, percent, raw, maxPossible }
    })
    .sort((a, b) => b.raw - a.raw)
}

/**
 * Returns top N products with a minimum percent threshold, backfilling with
 * highest-raw-score remainder if too few clear the bar.
 */
export function pickTopMatches(
  scored: ScoredProduct[],
  limit = 3,
  minPercent = 45
): ScoredProduct[] {
  const primary = scored.filter((s) => s.percent >= minPercent).slice(0, limit)
  if (primary.length >= limit) return primary
  const extras = scored
    .filter((s) => s.percent < minPercent)
    .slice(0, limit - primary.length)
  return [...primary, ...extras]
}
