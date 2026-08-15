import { daysBetween, monthsBetween } from './calendarDay'

/**
 * Prices are stored as whole won (PRD §4.1), so they are formatted with the
 * grouping people actually read rather than a currency symbol — "220,000원"
 * reads as Korean, "₩220,000" reads as a spreadsheet.
 */
export function formatPrice(price: number | null): string | null {
  if (price == null) return null
  return `${price.toLocaleString('ko-KR')}원`
}

/**
 * "2025. 11. 2." from a `YYYY-MM-DD` string.
 *
 * Formatted from the parts rather than through `new Date(iso)`, which parses a
 * bare date as UTC midnight — in any negative-offset timezone that renders as
 * the previous day. `purchased_at` is a calendar date with no time in it, so it
 * should not pass through a timezone at all.
 */
export function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!match) return null
  const [, year, month, day] = match
  return `${year}. ${Number(month)}. ${Number(day)}.`
}

/**
 * How long ago a calendar day was, in the coarsest unit that still says
 * something — 오늘 · 어제 · 5일 전 · 3주 전 · 2개월 전 · 1년 전.
 *
 * `today` is passed in rather than read from the clock. Every caller already
 * holds it (a grid of cards must not each ask separately and disagree across a
 * midnight), and it is what makes this testable without freezing time.
 *
 * The unit widens as the answer gets less precise, which is the honest
 * direction: "5일 전" is a thing to act on, "142일 전" is a number nobody
 * converts. The card has room for one of these and not the other.
 */
export function formatDayAgo(iso: string, today: string): string | null {
  const days = daysBetween(iso, today)
  if (days == null) return null

  // Clamped rather than drawn as a negative. The database accepts a wear dated
  // one day ahead of the server — that tolerance is the timezone, not slack —
  // so a phone carried east is legitimately looking at a row from "tomorrow",
  // and 오늘 is the least wrong thing to call it.
  if (days <= 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  if (days < 28) return `${Math.floor(days / 7)}주 전`

  const months = monthsBetween(iso, today)
  if (months == null) return null

  // Four weeks can still be zero calendar months — 1월 3일에서 1월 31일이
  // 그렇다 — and 0개월 전 is not a sentence. Past four weeks the coarser unit is
  // the one being used, so the floor is 1.
  if (months < 12) return `${Math.max(1, months)}개월 전`
  return `${Math.floor(months / 12)}년 전`
}
