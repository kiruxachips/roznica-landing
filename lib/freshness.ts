/**
 * Freshness computation for the landing page freshness badge.
 *
 * We roast-to-order, so "last roast" is effectively today (or the most recent
 * business day). "Next shipment" is the next business day after that.
 *
 * Dates are computed in Europe/Moscow timezone so the display matches
 * customer expectations regardless of server timezone.
 */

const TZ = "Europe/Moscow"

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
]

/** Returns a new Date whose local components equal Moscow-time components of `now`. */
function toMoscow(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)
  const d = new Date(0)
  d.setFullYear(get("year"), get("month") - 1, get("day"))
  d.setHours(get("hour"), get("minute"), get("second"), 0)
  return d
}

function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6
}

function previousBusinessDay(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  while (isWeekend(d)) d.setDate(d.getDate() - 1)
  return d
}

function nextBusinessDay(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  while (isWeekend(d)) d.setDate(d.getDate() + 1)
  return d
}

function formatDateRu(date: Date): string {
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`
}

function formatRelativeRu(date: Date, reference: Date): string {
  const ref = new Date(reference)
  ref.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)

  const diffDays = Math.round((target.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "сегодня"
  if (diffDays === -1) return "вчера"
  if (diffDays === 1) return "завтра"
  return formatDateRu(date)
}

export interface FreshnessInfo {
  lastRoastDate: Date
  nextShipmentDate: Date
  lastRoastLabel: string
  nextShipmentLabel: string
}

export function getFreshnessInfo(now: Date = new Date()): FreshnessInfo {
  const moscowNow = toMoscow(now)

  // Last roast = today if weekday, else previous business day
  const lastRoastDate = isWeekend(moscowNow) ? previousBusinessDay(moscowNow) : new Date(moscowNow)
  lastRoastDate.setHours(0, 0, 0, 0)

  // Next shipment = next business day after last roast
  const nextShipmentDate = nextBusinessDay(lastRoastDate)

  return {
    lastRoastDate,
    nextShipmentDate,
    lastRoastLabel: formatRelativeRu(lastRoastDate, moscowNow),
    nextShipmentLabel: formatRelativeRu(nextShipmentDate, moscowNow),
  }
}

export { formatDateRu, formatRelativeRu }
