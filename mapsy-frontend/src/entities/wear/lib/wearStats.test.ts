import { describe, expect, it } from 'vitest'
import { attachWears, itemIdsWornOn, summarizeWears } from './wearStats'
import type { WearEntry } from '../model/types'

const wears: WearEntry[] = [
  { itemId: 'a', wornOn: '2026-08-10' },
  { itemId: 'b', wornOn: '2026-08-10' },
  { itemId: 'a', wornOn: '2026-08-14' },
  { itemId: 'a', wornOn: '2026-07-02' },
]

describe('summarizeWears', () => {
  it('counts each garment and keeps its most recent day', () => {
    const summary = summarizeWears(wears)
    expect(summary.get('a')).toEqual({ wearCount: 3, lastWornOn: '2026-08-14' })
    expect(summary.get('b')).toEqual({ wearCount: 1, lastWornOn: '2026-08-10' })
  })

  it('does not depend on the rows arriving in any order', () => {
    // The fetch sorts newest first, but the cache patch after a submit appends —
    // so an implementation that trusted the order would be right until the first
    // recording of the session and wrong afterwards.
    const summary = summarizeWears([...wears].reverse())
    expect(summary.get('a')?.lastWornOn).toBe('2026-08-14')
  })

  it('compares days as strings, which is exact for this format', () => {
    // Zero-padded fixed width, so lexical order is calendar order. The case that
    // would break a naive numeric or partial comparison is a year boundary.
    const summary = summarizeWears([
      { itemId: 'a', wornOn: '2025-12-31' },
      { itemId: 'a', wornOn: '2026-01-01' },
    ])
    expect(summary.get('a')?.lastWornOn).toBe('2026-01-01')
  })

  it('has nothing to say about a garment with no entries', () => {
    expect(summarizeWears([]).get('a')).toBeUndefined()
  })
})

describe('attachWears', () => {
  it('gives every item a summary, including the ones never worn', () => {
    // Absent fields would have to be null-checked at each of the three places
    // that read them, and one of those is a comparator.
    const attached = attachWears([{ id: 'a' }, { id: 'z' }], wears)
    expect(attached).toEqual([
      { id: 'a', wearCount: 3, lastWornOn: '2026-08-14' },
      { id: 'z', wearCount: 0, lastWornOn: null },
    ])
  })

  it('does not mutate the items it was handed', () => {
    const items = [{ id: 'a', title: '니트' }]
    attachWears(items, wears)
    expect(items[0]).toEqual({ id: 'a', title: '니트' })
  })

  it('keeps the order it was given', () => {
    // The list arrives sorted by `applyFilters`; re-ordering here would undo it.
    expect(attachWears([{ id: 'b' }, { id: 'a' }], wears).map((i) => i.id)).toEqual(['b', 'a'])
  })
})

describe('itemIdsWornOn', () => {
  it('collects one day, and only that day', () => {
    // The set this returns seeds a selection whose submit *replaces* the day, so
    // a neighbouring date leaking in would be written back over it.
    expect([...itemIdsWornOn(wears, '2026-08-10')].sort()).toEqual(['a', 'b'])
    expect([...itemIdsWornOn(wears, '2026-08-14')]).toEqual(['a'])
  })

  it('is empty for a day with nothing on it', () => {
    expect(itemIdsWornOn(wears, '2026-08-15').size).toBe(0)
  })
})
