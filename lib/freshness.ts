/**
 * Freshness computation for the landing page freshness badge.
 *
 * We roast-to-order, so "last roast" is effectively today (or the most recent
 * business day). "Next shipment" is the next business day after that.
 *
 * Later we can override these via a SiteSetting table if a human wants manual
 * control from the admin panel.
 */

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
]

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

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
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
  // Last roast = today if weekday, else previous business day
  const lastRoastDate = isWeekend(now) ? previousBusinessDay(now) : new Date(now)
  lastRoastDate.setHours(0, 0, 0, 0)

  // Next shipment = next business day after last roast
  const nextShipmentDate = nextBusinessDay(lastRoastDate)

  return {
    lastRoastDate,
    nextShipmentDate,
    lastRoastLabel: formatRelativeRu(lastRoastDate, now),
    nextShipmentLabel: formatRelativeRu(nextShipmentDate, now),
  }
}

export { isSameDay, formatDateRu, formatRelativeRu }
