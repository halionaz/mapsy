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

  it('does not shift the day across timezones', () => {
    // `new Date('2025-11-02')` is UTC midnight, which renders as the 1st in any
    // negative-offset timezone. Parsing the parts avoids the round trip.
    expect(formatDate('2025-11-02')).toContain('11. 2.')
  })

  it('returns null for empty or malformed input', () => {
    expect(formatDate(null)).toBeNull()
    expect(formatDate('')).toBeNull()
    expect(formatDate('2025-11-02T00:00:00Z')).toBeNull()
    expect(formatDate('어제')).toBeNull()
  })
})
