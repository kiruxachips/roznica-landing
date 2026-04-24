/**
 * Интеграция с DaData API — подсказки и проверка юрлиц.
 *
 * ENV:
 *   DADATA_API_KEY — token из личного кабинета DaData
 *
 * Без API_KEY модуль возвращает null/[] — не ломает flow, просто деградация
 * к ручному заполнению формы заявки.
 */

const DADATA_API = "https://suggestions.dadata.ru/suggestions/api/4_1/rs"

export interface DadataPartySuggestion {
  value: string // "ООО РОМАШКА"
  unrestricted_value: string
  data: {
    inn?: string
    kpp?: string
    ogrn?: string
    type?: "LEGAL" | "INDIVIDUAL"
    name?: {
      full?: string
      full_with_opf?: string
      short?: string
      short_with_opf?: string
    }
    address?: {
      value?: string
      unrestricted_value?: string
    }
    state?: {
      status?: "ACTIVE" | "LIQUIDATING" | "LIQUIDATED" | "REORGANIZING" | "BANKRUPT"
      actuality_date?: number
      registration_date?: number
    }
    management?: {
      name?: string
      post?: string
    }
  }
}

function isConfigured(): boolean {
  return !!process.env.DADATA_API_KEY
}

/**
 * Поиск юрлиц для автозаполнения формы заявки. Вызывается по query "INN или название".
 * Возвращает до 5 совпадений.
 */
export async function suggestParty(query: string): Promise<DadataPartySuggestion[]> {
  if (!isConfigured() || !query.trim()) return []

  try {
    const res = await fetch(`${DADATA_API}/suggest/party`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${process.env.DADATA_API_KEY}`,
        Accept: "application/json",
      },
      body: JSON.stringify({ query, count: 5 }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { suggestions?: DadataPartySuggestion[] }
    return data.suggestions ?? []
  } catch {
    return []
  }
}

/**
 * Строгая проверка юрлица по ИНН (возвращает точное совпадение).
 * Используется при апруве заявки для audit и решения auto-activate vs manual.
 */
export async function findPartyByInn(inn: string): Promise<DadataPartySuggestion | null> {
  if (!isConfigured()) return null
  const clean = inn.replace(/\D/g, "")
  if (clean.length !== 10 && clean.length !== 12) return null

  try {
    const res = await fetch(`${DADATA_API}/findById/party`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${process.env.DADATA_API_KEY}`,
        Accept: "application/json",
      },
      body: JSON.stringify({ query: clean, count: 1 }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { suggestions?: DadataPartySuggestion[] }
    return data.suggestions?.[0] ?? null
  } catch {
    return null
  }
}

/**
 * Критерии auto-activate заявки — юрлицо в ACTIVE-статусе.
 * LIQUIDATING / LIQUIDATED / BANKRUPT / REORGANIZING — ручная проверка.
 */
export function isGreenStatus(status?: string | null): boolean {
  return status === "ACTIVE"
}
