import { describe, expect, it } from 'vitest'
import type { Item } from '@/entities/item'
import { groupSections } from './sections'

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

const labels = (items: Item[]) => groupSections(items).map((section) => section.group.label)

describe('groupSections', () => {
  it('leaves out the groups this wardrobe has nothing in', () => {
    // The whole point of the split: someone who owns no 원피스/셋업 and no 가방
    // should not be handed a heading for either, nor a chip built from one.
    expect(labels([item({ id: 'a' }), item({ id: 'b', categoryId: 'shoes.boots' })])).toEqual([
      '상의',
      '신발',
    ])
  })

  it('orders sections by the category table, not by what was registered first', () => {
    const registered = [
      item({ id: 'a', categoryId: 'shoes.boots' }),
      item({ id: 'b', categoryId: 'top.knit' }),
      item({ id: 'c', categoryId: 'bottom.denim' }),
    ]

    // Insertion order would put 신발 first and move the headings around every
    // time a garment is added, which is a screen that has to be re-read on each
    // visit.
    expect(labels(registered)).toEqual(['상의', '하의', '신발'])
  })

  it('keeps the order it was given inside a section', () => {
    const sorted = [
      item({ id: 'newer', categoryId: 'top.knit' }),
      item({ id: 'shoe', categoryId: 'shoes.boots' }),
      item({ id: 'older', categoryId: 'top.shirt' }),
    ]

    // The caller sorts — by 최근 등록순, 가격 높은순, whatever the sheet asked
    // for — and the split must not quietly re-order within a heading.
    expect(groupSections(sorted)[0].items.map((entry) => entry.id)).toEqual(['newer', 'older'])
  })

  it('sections an empty wardrobe into nothing at all', () => {
    expect(groupSections([])).toEqual([])
  })
})
