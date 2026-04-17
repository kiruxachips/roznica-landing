import type { Answers } from "./questions"

export interface ScorableProduct {
  id: string
  // Slugs of ProductCollection rows this product belongs to. This is the
  // primary scoring signal — curated collections are a much cleaner grouping
  // than ad-hoc flavour-keyword matching.
  collectionSlugs: string[]
  brewingMethods: string[]
  reviewCount: number
  averageRating: number | null
}

// Collection slugs used by the scorer. Mirrors prisma/seed-collections.ts.
// Kept as literal types so a typo here would fail typecheck.
type Slug =
  | "s-molokom"
  | "klassika"
  | "shokoladno-orehovyy"
  | "s-kislinkoy"
  | "dlya-espresso"
  | "dlya-znatokov"
  | "bez-kofeina"
  | "alt-formaty"

type CollectionWeights = Partial<Record<Slug, number>>

// Mapping from quiz answer to a per-collection weight delta. Positive numbers
// pull a product toward the match, negatives push it away. All axes compose
// additively, so overlaps (e.g. "С молоком" + "Шоколадный вкус") naturally
// amplify collections that satisfy both (shokoladno-orehovyy here).
function collectionWeights(answers: Answers): CollectionWeights {
  const w: CollectionWeights = {}
  const add = (slug: Slug, n: number) => {
    w[slug] = (w[slug] ?? 0) + n
  }

  // Q1: milk preference — the highest-weight signal because it drives the
  // biggest split in coffee choice (milk kills bright acidity; black reveals it).
  if (answers.milk === "milk") {
    add("s-molokom", 35)
    add("dlya-espresso", 15)
    add("shokoladno-orehovyy", 10)
    add("s-kislinkoy", -25)
  } else if (answers.milk === "black") {
    add("s-kislinkoy", 15)
    add("klassika", 10)
    add("dlya-znatokov", 10)
    add("shokoladno-orehovyy", 5)
    add("s-molokom", -10)
  }
  // "both" → no bias, let the other axes decide

  // Q2: flavour profile
  if (answers.flavor === "chocolate") {
    add("shokoladno-orehovyy", 30)
    add("klassika", 10)
    add("s-kislinkoy", -15)
  } else if (answers.flavor === "balanced") {
    add("klassika", 30)
    add("shokoladno-orehovyy", 10)
    add("s-molokom", 10)
  } else if (answers.flavor === "fruity") {
    add("s-kislinkoy", 30)
    add("dlya-znatokov", 15)
    add("s-molokom", -10)
    add("shokoladno-orehovyy", -10)
  }
  // "any" → no bias

  // Q3: acidity — refines flavour choice
  if (answers.acidity === "low") {
    add("s-molokom", 10)
    add("shokoladno-orehovyy", 10)
    add("klassika", 5)
    add("s-kislinkoy", -25)
    add("dlya-znatokov", -10)
  } else if (answers.acidity === "high") {
    add("s-kislinkoy", 25)
    add("dlya-znatokov", 15)
    add("s-molokom", -15)
    add("shokoladno-orehovyy", -10)
  } else if (answers.acidity === "mid") {
    add("klassika", 15)
    add("s-molokom", 5)
    add("shokoladno-orehovyy", 5)
  }

  // Q4: brewing method — nudges toward expected collections. The actual
  // method-array match gets a secondary boost below; this is the collection
  // correlation signal only.
  if (answers.brewing === "espresso") {
    add("dlya-espresso", 25)
    add("s-molokom", 5)
    add("shokoladno-orehovyy", 5)
  } else if (answers.brewing === "filter") {
    // Filter/pour-over tends to reward clean, acidic cups.
    add("s-kislinkoy", 15)
    add("dlya-znatokov", 10)
    add("klassika", 5)
  }
  // turka, french-press, any → all coffees are fine, no collection bias

  // Q5: experience level
  if (answers.experience === "beginner") {
    add("klassika", 20)
    add("s-molokom", 10)
    add("shokoladno-orehovyy", 10)
    add("dlya-znatokov", -15) // steer away from complex profiles
  } else if (answers.experience === "enthusiast") {
    add("dlya-znatokov", 25)
    add("s-kislinkoy", 10)
    add("klassika", -5) // too vanilla for this user
  }
  // "regular" → no bias

  return w
}

// Brewing-method exact match, with soft neighbours for similar methods.
// E.g. a filter-loving user is also happy with aeropress.
function brewingBoost(userMethod: string | undefined, productMethods: string[]): number {
  if (!userMethod || userMethod === "any") return 0
  if (productMethods.includes(userMethod)) return 15
  const neighbours: Record<string, string[]> = {
    filter: ["aeropress"],
    aeropress: ["filter"],
    "french-press": ["moka"],
    moka: ["french-press"],
    espresso: ["moka"],
  }
  const alt = neighbours[userMethod] ?? []
  if (alt.some((m) => productMethods.includes(m))) return 8
  return 0
}

export interface ScoredProduct {
  productId: string
  score: number
  percent: number // 0-100 confidence, bounded by answer weights
  matchedCollections: string[] // collection slugs that positively contributed
}

export function scoreProducts(
  products: ScorableProduct[],
  answers: Answers
): ScoredProduct[] {
  const weights = collectionWeights(answers)
  // The theoretical maximum score for this answer set — used to normalise
  // a "confidence" percent that users see. Only positive weights count.
  const maxPositive = Object.values(weights).reduce<number>(
    (s, v) => s + (v && v > 0 ? v : 0),
    0
  )
  const maxBrewing = answers.brewing && answers.brewing !== "any" ? 15 : 0
  const maxSocial = 15 // reviewCount/rating ceiling below
  const maxPossible = Math.max(1, maxPositive + maxBrewing + maxSocial)

  return products
    .map((p) => {
      // Hard excludes: decaf and alternative formats (drip packets) aren't
      // what users come here to be "matched" with — they pick those on purpose.
      if (p.collectionSlugs.includes("bez-kofeina")) {
        return { productId: p.id, score: -Infinity, percent: 0, matchedCollections: [] }
      }
      if (p.collectionSlugs.includes("alt-formaty")) {
        return { productId: p.id, score: -Infinity, percent: 0, matchedCollections: [] }
      }

      let score = 0
      const matched: string[] = []
      for (const c of p.collectionSlugs) {
        const delta = weights[c as Slug]
        if (delta !== undefined) {
          score += delta
          if (delta > 0) matched.push(c)
        }
      }

      // Secondary: brewing method actually works
      score += brewingBoost(answers.brewing, p.brewingMethods)

      // Tertiary: social proof — popular well-rated coffees tiebreak.
      // Capped small so it can't flip a bad match into a "perfect" one.
      const socialBoost =
        Math.min(p.reviewCount, 20) * 0.4 +
        (p.averageRating !== null ? Math.max(0, (p.averageRating - 4.2) * 6) : 0)
      score += Math.min(socialBoost, 15)

      const percent = Math.max(
        0,
        Math.min(100, Math.round((score / maxPossible) * 100))
      )
      return { productId: p.id, score, percent, matchedCollections: matched }
    })
    .sort((a, b) => b.score - a.score)
}

/**
 * Picks top N matches. No hard percent threshold — even a mediocre fit is
 * better than nothing, and we tier-label the UI by rank instead.
 */
export function pickTopMatches(scored: ScoredProduct[], limit = 3): ScoredProduct[] {
  return scored.filter((s) => s.score > -Infinity).slice(0, limit)
}

// Human-readable reasons the scorer liked a product, based on which
// collections matched. Shown in QuizResult so users understand the pick.
const COLLECTION_REASON: Record<string, string> = {
  "s-molokom": "раскроется в латте и капучино",
  "klassika": "надёжная классика",
  "shokoladno-orehovyy": "шоколадно-ореховый профиль",
  "s-kislinkoy": "яркий фруктовый вкус",
  "dlya-espresso": "создан для эспрессо",
  "dlya-znatokov": "сложный многогранный профиль",
}

export function reasonsForMatch(matchedCollections: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of matchedCollections) {
    const r = COLLECTION_REASON[c]
    if (r && !seen.has(r)) {
      seen.add(r)
      out.push(r)
    }
  }
  return out.slice(0, 2) // two reasons max — cards stay compact
}
