import { describe, expect, it } from 'vitest'
import { formatDate, formatPrice } from './format'

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
