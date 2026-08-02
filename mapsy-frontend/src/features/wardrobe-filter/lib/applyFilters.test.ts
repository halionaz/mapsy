import { describe, expect, it } from 'vitest'
import type { Item } from '@/entities/item'
import { applyFilters } from './applyFilters'
import { EMPTY_FILTERS, type WardrobeFilters } from '../model/filters'

function item(overrides: Partial<Item> & { id: string }): Item {
  return {
    userId: 'u1',
    title: '기본 옷',
    categoryId: 'top.knit',
    brand: null,
    size: null,
    fit: null,
    colors: [],
    seasons: [],
    price: null,
    purchasedAt: null,
    purchasePlace: null,
    memo: null,
    tags: [],
    status: 'owned',
    isFavorite: false,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function filters(overrides: Partial<WardrobeFilters> = {}): WardrobeFilters {
  return { ...EMPTY_FILTERS, ...overrides }
}

const navyJacket = item({
  id: 'a',
  title: '노스페이스 자켓',
  categoryId: 'outer.jacket',
  brand: '노스페이스',
  size: 'M',
  colors: ['navy'],
  seasons: ['fall', 'winter'],
  price: 300000,
  tags: ['출근용'],
  createdAt: '2026-03-01T00:00:00Z',
})

const blackTee = item({
  id: 'b',
  title: '검정 반팔',
  categoryId: 'top.tshirt_short',
  brand: '유니클로',
  size: 'L',
  colors: ['black'],
  seasons: ['summer'],
  price: 19000,
  createdAt: '2026-02-01T00:00:00Z',
})

const soldDenim = item({
  id: 'c',
  title: '리바이스 501',
  categoryId: 'bottom.denim',
  colors: ['blue'],
  status: 'disposed',
  createdAt: '2026-01-15T00:00:00Z',
})

const all = [navyJacket, blackTee, soldDenim]
const ids = (result: Item[]) => result.map((i) => i.id)

describe('applyFilters', () => {
  it('shows only owned items by default', () => {
    expect(ids(applyFilters(all, filters()))).toEqual(['a', 'b'])
  })

  it('can show disposed items instead', () => {
    expect(ids(applyFilters(all, filters({ status: 'disposed' })))).toEqual(['c'])
  })

  it('ORs values within one axis', () => {
    const result = applyFilters(all, filters({ colors: ['navy', 'black'] }))
    expect(ids(result)).toEqual(['a', 'b'])
  })

  it('ANDs across axes', () => {
    // navy OR black narrows to a+b, then 여름 leaves only b.
    const result = applyFilters(all, filters({ colors: ['navy', 'black'], seasons: ['summer'] }))
    expect(ids(result)).toEqual(['b'])
  })

  it('filters by category group', () => {
    expect(ids(applyFilters(all, filters({ groupIds: ['outer'] })))).toEqual(['a'])
  })

  it('filters by exact subcategory', () => {
    expect(ids(applyFilters(all, filters({ categoryIds: ['top.tshirt_short'] })))).toEqual(['b'])
  })

  it('filters by size, fit and brand', () => {
    expect(ids(applyFilters(all, filters({ sizes: ['M'] })))).toEqual(['a'])
    expect(ids(applyFilters(all, filters({ brands: ['유니클로'] })))).toEqual(['b'])
  })

  it('excludes items whose value is null when that axis is filtered', () => {
    // blackTee has no fit, so a fit filter must not accidentally keep it.
    expect(ids(applyFilters(all, filters({ fits: ['오버'] })))).toEqual([])
  })

  it('filters favourites', () => {
    const favourite = { ...blackTee, isFavorite: true }
    const result = applyFilters([navyJacket, favourite], filters({ favoriteOnly: true }))
    expect(ids(result)).toEqual(['b'])
  })

  it('searches title, brand, memo and tags', () => {
    expect(ids(applyFilters(all, filters({ query: '반팔' })))).toEqual(['b'])
    expect(ids(applyFilters(all, filters({ query: '유니클로' })))).toEqual(['b'])
    expect(ids(applyFilters(all, filters({ query: '출근용' })))).toEqual(['a'])
  })

  it('searches by 초성', () => {
    expect(ids(applyFilters(all, filters({ query: 'ㄴㅅㅍ' })))).toEqual(['a'])
  })

  it('sorts by newest first by default', () => {
    expect(ids(applyFilters(all, filters()))).toEqual(['a', 'b'])
  })

  it('sorts by price in both directions', () => {
    expect(ids(applyFilters(all, filters({ sort: 'price_asc' })))).toEqual(['b', 'a'])
    expect(ids(applyFilters(all, filters({ sort: 'price_desc' })))).toEqual(['a', 'b'])
  })

  it('sinks items with no price to the bottom regardless of direction', () => {
    // A missing price is unknown, not free — it must not win "cheapest".
    const noPrice = item({ id: 'd', title: '가격 미상', createdAt: '2026-04-01T00:00:00Z' })
    const list = [navyJacket, blackTee, noPrice]
    expect(ids(applyFilters(list, filters({ sort: 'price_asc' })))).toEqual(['b', 'a', 'd'])
    expect(ids(applyFilters(list, filters({ sort: 'price_desc' })))).toEqual(['a', 'b', 'd'])
  })

  it('sorts by title using Korean collation', () => {
    expect(ids(applyFilters(all, filters({ sort: 'title' })))).toEqual(['b', 'a'])
  })

  it('does not mutate or reorder the input array', () => {
    const input = [blackTee, navyJacket]
    const before = ids(input)
    applyFilters(input, filters({ sort: 'title' }))
    expect(ids(input)).toEqual(before)
  })
})
