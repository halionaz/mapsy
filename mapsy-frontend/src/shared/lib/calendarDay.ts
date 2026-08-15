/**
 * The calendar day the wearer is in, as `YYYY-MM-DD`.
 *
 * A wear is recorded against a day, not an instant — "I wore this today", where
 * today is the day on the phone in the pocket. So every value here comes off the
 * local clock and never passes through UTC.
 *
 * `new Date().toISOString().slice(0, 10)` is the one-liner this exists to
 * replace. It converts to UTC first, and Seoul is nine hours ahead: every
 * garment picked before 09:00 would be filed under the previous day, every day,
 * without anything looking broken.
 *
 * `supabase/migrations/20260815000001_item_wears.sql` is the other half of the
 * same rule — the column is a `date` with no default, so the server can never
 * quietly supply its own.
 */

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * Yesterday, by the same local clock.
 *
 * Through `setDate` rather than by subtracting 86,400,000ms: a day is not always
 * 24 hours long. On the two DST changeovers a millisecond subtraction lands at
 * 23:00 or 01:00 of the wrong day, and `setDate(-1)` is the operation that means
 * "the previous calendar day" whatever the clocks did. Korea has no DST today,
 * which is exactly why this would have gone unnoticed.
 */
export function yesterdayLocal(now: Date = new Date()): string {
  const previous = new Date(now)
  previous.setDate(previous.getDate() - 1)
  return todayLocal(previous)
}

export interface CalendarDay {
  year: number
  month: number
  day: number
}

/**
 * Parses `YYYY-MM-DD`, or null if it is not one.
 *
 * The round-trip is the validation. `Date.UTC` rolls over rather than
 * rejecting — month 13 becomes next January and day 32 becomes the 1st — so
 * building a Date and reading it back is what tells a real date from a rolled
 * one. The regex alone accepts `2026-13-40`.
 */
export function parseDay(iso: string): CalendarDay | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!match) return null

  const [, year, month, day] = match
  const parsed = { year: Number(year), month: Number(month), day: Number(day) }
  const rolled = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day))
  if (Number.isNaN(rolled.getTime())) return null

  return rolled.getUTCFullYear() === parsed.year &&
    rolled.getUTCMonth() + 1 === parsed.month &&
    rolled.getUTCDate() === parsed.day
    ? parsed
    : null
}

/**
 * Whole days from `from` to `to`, or null if either is not a calendar day.
 *
 * The arithmetic goes through UTC on purpose, which is not a contradiction of
 * the rule above: both ends are UTC midnight, so the difference is a whole
 * number of days no matter what any local clock is doing. Doing the same
 * subtraction on local Dates is what a DST boundary breaks.
 */
export function daysBetween(from: string, to: string): number | null {
  const start = parseDay(from)
  const end = parseDay(to)
  if (!start || !end) return null

  const DAY_MS = 86_400_000
  return Math.round(
    (Date.UTC(end.year, end.month - 1, end.day) -
      Date.UTC(start.year, start.month - 1, start.day)) /
      DAY_MS,
  )
}

/**
 * Whole calendar months from `from` to `to`, or null if either is not a day.
 *
 * Counted off the calendar rather than as `days / 30`, which is wrong in a way
 * that shows: 360 days is twelve of those months, so a coat last worn a year ago
 * would read 12개월 전 instead of 1년 전. Here a month elapses when the same
 * day-of-month comes round, and the subtraction at the end is what withholds it
 * until then.
 */
export function monthsBetween(from: string, to: string): number | null {
  const start = parseDay(from)
  const end = parseDay(to)
  if (!start || !end) return null

  const elapsed = (end.year - start.year) * 12 + (end.month - start.month)
  return elapsed - (end.day < start.day ? 1 : 0)
}
