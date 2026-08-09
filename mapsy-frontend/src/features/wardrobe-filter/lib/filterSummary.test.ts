import { describe, expect, it } from 'vitest'

import { EMPTY_FILTERS, type WardrobeFilters } from '../model/filters'
import {
  activeFilterCount,
  appliedFilters,
  clearFilters,
  removeApplied,
} from './filterSummary'

function filters(overrides: Partial<WardrobeFilters> = {}): WardrobeFilters {
  return { ...EMPTY_FILTERS, ...overrides }
}

describe('appliedFilters', () => {
  it('is empty for untouched filters', () => {
    expect(appliedFilters(EMPTY_FILTERS)).toEqual([])
  })

  it('labels preset axes with their Korean names, not their ids', () => {
    const applied = appliedFilters(filters({ colors: ['navy'], seasons: ['summer'] }))
    expect(applied.map((entry) => entry.label)).toEqual(['네이비', '여름'])
  })

  it('prefixes tags with #', () => {
    expect(appliedFilters(filters({ tags: ['출근용'] }))[0].label).toBe('#출근용')
  })

  it('keys are unique across axes holding the same string', () => {
    const applied = appliedFilters(filters({ sizes: ['M'], fits: ['M'], brands: ['M'] }))
    expect(new Set(applied.map((entry) => entry.key)).size).toBe(3)
  })

  /**
   * The category rail already draws this choice as a lit chip. A second,
   * removable copy in the summary row would be two controls for one filter, and
   * the pair drifts the moment one of them is changed.
   */
  it('leaves the category group out', () => {
    expect(appliedFilters(filters({ groupIds: ['top'] }))).toEqual([])
  })

  /**
   * `categoryIds` was missing from the hand-written axis list while being a real
   * field on `WardrobeFilters` that `applyFilters` honours — so a filter set
   * through it would have narrowed the grid while counting as zero here, leaving
   * 초기화 disabled over a filtered screen. The list is now derived from the
   * type, and this holds that derivation down.
   */
  it('covers every value axis the filter type has, including the unused one', () => {
    const applied = appliedFilters(filters({ categoryIds: ['top.tshirt_short'] }))
    expect(applied).toHaveLength(1)
    expect(applied[0].axis).toBe('categoryIds')
  })

  it('does not treat the search query, status or sort as removable filters', () => {
    const busy = filters({ query: '플리스', status: 'disposed', sort: 'price_desc' })
    expect(appliedFilters(busy)).toEqual([])
  })

  it('counts the favourite toggle once when on and never when off', () => {
    expect(activeFilterCount(filters({ favoriteOnly: true }))).toBe(1)
    expect(activeFilterCount(filters({ favoriteOnly: false }))).toBe(0)
  })
})

describe('removeApplied', () => {
  it('removes only the named value from its own axis', () => {
    const before = filters({ colors: ['black', 'navy'], seasons: ['summer'] })
    const [, navy] = appliedFilters(before)
    const after = removeApplied(before, navy)

    expect(after.colors).toEqual(['black'])
    expect(after.seasons).toEqual(['summer'])
  })

  it('clears the favourite toggle', () => {
    const before = filters({ favoriteOnly: true })
    const after = removeApplied(before, appliedFilters(before)[0])
    expect(after.favoriteOnly).toBe(false)
  })

  /**
   * The same string can sit in several axes — "M" is a size and a fit — and an
   * entry carries which one it came from precisely so that removing it does not
   * take the others with it.
   */
  it('does not remove an equal value from a different axis', () => {
    const before = filters({ sizes: ['M'], fits: ['M'] })
    const size = appliedFilters(before).find((entry) => entry.axis === 'sizes')!
    const after = removeApplied(before, size)

    expect(after.sizes).toEqual([])
    expect(after.fits).toEqual(['M'])
  })

  it('leaves the input untouched', () => {
    const before = filters({ colors: ['black', 'navy'] })
    removeApplied(before, appliedFilters(before)[0])
    expect(before.colors).toEqual(['black', 'navy'])
  })
})

describe('clearFilters', () => {
  const busy = filters({
    query: '플리스',
    groupIds: ['top'],
    colors: ['black'],
    seasons: ['winter'],
    sizes: ['M'],
    fits: ['오버핏'],
    brands: ['유니클로'],
    tags: ['출근용'],
    favoriteOnly: true,
    status: 'disposed',
    sort: 'title',
  })

  it('clears every axis the sheet owns', () => {
    expect(activeFilterCount(clearFilters(busy))).toBe(0)
  })

  /**
   * These four are held by controls outside the sheet — the search box, the
   * category rail, the wardrobe/처분함 switch — so resetting the sheet must not
   * reach into them.
   */
  it('keeps the query, category, status and sort', () => {
    const cleared = clearFilters(busy)
    expect(cleared.query).toBe('플리스')
    expect(cleared.groupIds).toEqual(['top'])
    expect(cleared.status).toBe('disposed')
    expect(cleared.sort).toBe('title')
  })
})
