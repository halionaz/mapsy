/**
 * Confines a number to a range.
 *
 * Here rather than beside its first caller because there is no first caller any
 * more: the photo viewer's gesture geometry and the detail screen's scroll
 * position both need it, and a screen reaching into a gesture module for a
 * two-line arithmetic helper says the two are related when they are not.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
