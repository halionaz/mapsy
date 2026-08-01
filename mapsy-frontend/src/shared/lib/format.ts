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
