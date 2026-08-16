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
  it('이 옷장에 아무것도 없는 그룹은 뺀다', () => {
    // 나누는 이유의 전부다 — 원피스/셋업도 가방도 없는 사람에게 그 제목을 건네서도,
    // 그것으로 지은 칩을 건네서도 안 된다.
    expect(labels([item({ id: 'a' }), item({ id: 'b', categoryId: 'shoes.boots' })])).toEqual([
      '상의',
      '신발',
    ])
  })

  it('먼저 등록된 순서가 아니라 카테고리 표 순서로 구획을 놓는다', () => {
    const registered = [
      item({ id: 'a', categoryId: 'shoes.boots' }),
      item({ id: 'b', categoryId: 'top.knit' }),
      item({ id: 'c', categoryId: 'bottom.denim' }),
    ]

    // 삽입 순서였다면 신발이 먼저 오고 옷을 등록할 때마다 제목이 움직인다.
    // 방문할 때마다 다시 읽어야 하는 화면이다.
    expect(labels(registered)).toEqual(['상의', '하의', '신발'])
  })

  it('구획 안에서는 받은 순서를 지킨다', () => {
    const sorted = [
      item({ id: 'newer', categoryId: 'top.knit' }),
      item({ id: 'shoe', categoryId: 'shoes.boots' }),
      item({ id: 'older', categoryId: 'top.shirt' }),
    ]

    // 정렬은 호출부가 한다 — 최근 등록순이든 가격 높은순이든 시트가 요청한 것으로 —
    // 그리고 나누기가 제목 안에서 조용히 재정렬하면 안 된다.
    expect(groupSections(sorted)[0].items.map((entry) => entry.id)).toEqual(['newer', 'older'])
  })

  it('빈 옷장은 아무 구획도 만들지 않는다', () => {
    expect(groupSections([])).toEqual([])
  })
})
