/**
 * Prices are stored as whole won (PRD §4.1), so they are formatted with the
 * grouping people actually read rather than a currency symbol — "220,000원"
 * reads as Korean, "₩220,000" reads as a spreadsheet.
 */
export function formatPrice(price: number | null): string | null {
  if (price == null) return null
  return `${price.toLocaleString('ko-KR')}원`
}

/** "2025. 11. 2." from an ISO date, or null when there is no date. */
export function formatDate(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('ko-KR')
}
