import { describe, expect, it } from 'vitest'
import { formatDate, formatDayAgo, formatPrice } from './format'

describe('formatPrice', () => {
  it('groups thousands and appends 원', () => {
    expect(formatPrice(220000)).toBe('220,000원')
  })

  it('keeps zero rather than treating it as absent', () => {
    // A gift or a hand-me-down is genuinely 0원.
    expect(formatPrice(0)).toBe('0원')
  })

  it('returns null when there is no price', () => {
    expect(formatPrice(null)).toBeNull()
  })
})

describe('formatDate', () => {
  it('formats a calendar date without stripping leading zeros awkwardly', () => {
    expect(formatDate('2025-11-02')).toBe('2025. 11. 2.')
    expect(formatDate('2026-01-15')).toBe('2026. 1. 15.')
  })

  it('does not shift the day in a negative-offset timezone', () => {
    // The regression this guards only appears west of UTC: `new Date('2025-11-02')`
    // is UTC midnight, which renders as the 1st there. Running in the host's
    // timezone would pass on a KST machine no matter which implementation is in
    // place, so the process timezone is pinned for this assertion.
    // Reached through globalThis so the app's tsconfig doesn't need node types
    // just for this one assertion.
    const env = (globalThis as { process?: { env: Record<string, string | undefined> } })
      .process?.env
    const original = env?.TZ
    if (env) env.TZ = 'America/New_York'
    try {
      // Self-check first: if the TZ change stopped taking effect — a different
      // worker isolation mode, a Node change — the assertion below would pass
      // for the wrong reason and this guard would quietly become a tautology.
      // This line also records what the old implementation did.
      expect(new Date('2025-11-02').toLocaleDateString('ko-KR')).toBe('2025. 11. 1.')
      expect(formatDate('2025-11-02')).toBe('2025. 11. 2.')
    } finally {
      if (env) env.TZ = original
    }
  })

  it('returns null for empty or malformed input', () => {
    expect(formatDate(null)).toBeNull()
    expect(formatDate('')).toBeNull()
    expect(formatDate('2025-11-02T00:00:00Z')).toBeNull()
    expect(formatDate('어제')).toBeNull()
  })
})

describe('formatDayAgo', () => {
  const today = '2026-08-15'

  it('names the two days that have names', () => {
    expect(formatDayAgo('2026-08-15', today)).toBe('오늘')
    expect(formatDayAgo('2026-08-14', today)).toBe('어제')
  })

  it('widens the unit as the answer gets less precise', () => {
    // 5일 전 is a thing to act on; 142일 전 is a number nobody converts, and the
    // card has room for one of the two.
    expect(formatDayAgo('2026-08-10', today)).toBe('5일 전')
    expect(formatDayAgo('2026-08-01', today)).toBe('2주 전')
    expect(formatDayAgo('2026-06-15', today)).toBe('2개월 전')
    expect(formatDayAgo('2025-08-15', today)).toBe('1년 전')
  })

  it('never says 0개월 전', () => {
    // Four weeks can span no calendar month at all, which is where the floor of
    // 1 in the 개월 branch earns its place.
    expect(formatDayAgo('2026-01-03', '2026-01-31')).toBe('1개월 전')
  })

  it('reads a year as 년 rather than as twelve months', () => {
    // 360 days is twelve `days / 30` months, which is the arithmetic this
    // deliberately does not use.
    expect(formatDayAgo('2025-08-20', today)).toBe('11개월 전')
    expect(formatDayAgo('2025-08-14', today)).toBe('1년 전')
  })

  it('calls a day in the future 오늘 rather than a negative', () => {
    // The database accepts a wear dated one day ahead of the server — that
    // tolerance is the timezone, not slack — so this is reachable from a phone
    // carried east, and "-1일 전" is not a thing to put on a card.
    expect(formatDayAgo('2026-08-16', today)).toBe('오늘')
  })

  it('is null when either day is malformed', () => {
    expect(formatDayAgo('어제', today)).toBeNull()
    expect(formatDayAgo(today, '')).toBeNull()
  })
})
