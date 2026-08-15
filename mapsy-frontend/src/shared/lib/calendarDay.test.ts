import { describe, expect, it } from 'vitest'
import { daysBetween, monthsBetween, parseDay, todayLocal, yesterdayLocal } from './calendarDay'

/**
 * Every assertion here pins a `Date` rather than reading the clock, so a failure
 * means the arithmetic changed rather than that the suite ran at an awkward hour.
 */

describe('todayLocal', () => {
  it('reads the local calendar day, not the UTC one', () => {
    // The regression this guards is the one-liner it replaces:
    // `toISOString().slice(0, 10)`. In Seoul, 08:00 on the 15th is still the
    // 14th in UTC — so that shape files a whole morning's clothes under
    // yesterday, every day, with nothing looking broken.
    const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process
      ?.env
    const original = env?.TZ
    if (env) env.TZ = 'Asia/Seoul'
    try {
      const morning = new Date('2026-08-14T23:30:00Z') // 15일 08:30 KST
      // What the replaced one-liner answers, written down. `toISOString` is UTC
      // whatever the process timezone is, so this is a record of the wrong
      // answer and not a check on the pinning above — if `env.TZ` stopped taking
      // effect the assertion below would fail, loudly, which is the whole guard.
      expect(morning.toISOString().slice(0, 10)).toBe('2026-08-14')
      expect(todayLocal(morning)).toBe('2026-08-15')
    } finally {
      if (env) env.TZ = original
    }
  })

  it('zero-pads, so the strings sort as dates', () => {
    // Fixed width is what lets `lastWornOn` be compared with `>` instead of
    // being parsed — see `summarizeWears`.
    expect(todayLocal(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
  })
})

describe('yesterdayLocal', () => {
  it('steps back a calendar day across a month boundary', () => {
    expect(yesterdayLocal(new Date(2026, 2, 1, 9))).toBe('2026-02-28')
  })

  it('steps back across a year boundary', () => {
    expect(yesterdayLocal(new Date(2026, 0, 1, 9))).toBe('2025-12-31')
  })

  it('handles a leap day', () => {
    expect(yesterdayLocal(new Date(2028, 2, 1, 9))).toBe('2028-02-29')
  })
})

describe('parseDay', () => {
  it('reads a calendar day', () => {
    expect(parseDay('2026-08-15')).toEqual({ year: 2026, month: 8, day: 15 })
  })

  it('rejects a date that only looks like one', () => {
    // `Date.UTC` rolls these over rather than refusing them — month 13 becomes
    // next January, day 32 the 1st — so the regex alone would let them through
    // as some other date entirely.
    expect(parseDay('2026-13-01')).toBeNull()
    expect(parseDay('2026-02-30')).toBeNull()
    expect(parseDay('2026-08-32')).toBeNull()
  })

  it('rejects anything that is not a bare day', () => {
    expect(parseDay('2026-8-15')).toBeNull()
    expect(parseDay('2026-08-15T00:00:00Z')).toBeNull()
    expect(parseDay('어제')).toBeNull()
    expect(parseDay('')).toBeNull()
  })
})

describe('daysBetween', () => {
  it('counts whole days forward', () => {
    expect(daysBetween('2026-08-10', '2026-08-15')).toBe(5)
  })

  it('counts across a month and a leap year', () => {
    expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1)
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2)
  })

  it('goes negative when the second day is earlier', () => {
    expect(daysBetween('2026-08-15', '2026-08-14')).toBe(-1)
  })

  it('is null when either end is not a day', () => {
    expect(daysBetween('어제', '2026-08-15')).toBeNull()
    expect(daysBetween('2026-08-15', '2026-02-30')).toBeNull()
  })
})

describe('monthsBetween', () => {
  it('waits for the day of the month to come round', () => {
    expect(monthsBetween('2026-01-15', '2026-02-14')).toBe(0)
    expect(monthsBetween('2026-01-15', '2026-02-15')).toBe(1)
  })

  it('counts a year as twelve', () => {
    // `days / 30` gives 12.16 here and 12 for 360 days, which is what would put
    // 12개월 전 on a coat last worn a year ago.
    expect(monthsBetween('2025-08-15', '2026-08-15')).toBe(12)
    expect(monthsBetween('2025-09-01', '2026-08-26')).toBe(11)
  })

  it('is null when either end is not a day', () => {
    expect(monthsBetween('2026-08-15', '')).toBeNull()
  })
})
