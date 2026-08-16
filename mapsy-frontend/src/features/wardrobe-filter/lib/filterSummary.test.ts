import { describe, expect, it } from 'vitest'

import { EMPTY_FILTERS, type WardrobeFilters } from '../model/filters'
import { activeFilterCount, appliedFilters, clearFilters, removeApplied } from './filterSummary'

function filters(overrides: Partial<WardrobeFilters> = {}): WardrobeFilters {
  return { ...EMPTY_FILTERS, ...overrides }
}

describe('appliedFilters', () => {
  it('건드리지 않은 필터에서는 비어 있다', () => {
    expect(appliedFilters(EMPTY_FILTERS)).toEqual([])
  })

  it('프리셋 축을 id가 아니라 한국어 이름으로 라벨링한다', () => {
    const applied = appliedFilters(filters({ colors: ['navy'], seasons: ['summer'] }))
    expect(applied.map((entry) => entry.label)).toEqual(['네이비', '여름'])
  })

  it('태그 앞에 #을 붙인다', () => {
    expect(appliedFilters(filters({ tags: ['출근용'] }))[0].label).toBe('#출근용')
  })

  it('같은 문자열을 담은 축들 사이에서도 키가 유일하다', () => {
    const applied = appliedFilters(filters({ sizes: ['M'], fits: ['M'], brands: ['M'] }))
    expect(new Set(applied.map((entry) => entry.key)).size).toBe(3)
  })

  /**
   * 카테고리 레일이 이미 이 선택을 켜진 칩으로 그린다. 요약 행에 지울 수 있는 사본을
   * 하나 더 두면 필터 하나에 컨트롤이 둘이 되고, 하나가 바뀌는 순간 둘이 어긋난다.
   */
  it('대분류는 빼둔다', () => {
    expect(appliedFilters(filters({ groupIds: ['top'] }))).toEqual([])
  })

  /**
   * `categoryIds`는 손으로 쓴 축 목록에서 빠져 있으면서 `applyFilters`가 존중하는 진짜
   * 필드였다 — 그 축으로 건 필터는 격자를 좁히면서 여기서는 0으로 세어져, 걸러진 화면
   * 위에서 초기화가 잠긴 채로 남았다. 목록은 이제 타입에서 파생되고, 이것이 그 파생을 붙든다.
   */
  it('아직 쓰이지 않는 것까지, 필터 타입의 모든 값 축을 덮는다', () => {
    const applied = appliedFilters(filters({ categoryIds: ['top.tshirt_short'] }))
    expect(applied).toHaveLength(1)
    expect(applied[0].axis).toBe('categoryIds')
  })

  it('검색어·상태·정렬을 지울 수 있는 필터로 보지 않는다', () => {
    const busy = filters({ query: '플리스', status: 'disposed', sort: 'price_desc' })
    expect(appliedFilters(busy)).toEqual([])
  })

  it('즐겨찾기 토글을 켜졌을 때 한 번만 세고 꺼졌을 때는 세지 않는다', () => {
    expect(activeFilterCount(filters({ favoriteOnly: true }))).toBe(1)
    expect(activeFilterCount(filters({ favoriteOnly: false }))).toBe(0)
  })
})

describe('removeApplied', () => {
  it('이름 붙은 값만 자기 축에서 지운다', () => {
    const before = filters({ colors: ['black', 'navy'], seasons: ['summer'] })
    const [, navy] = appliedFilters(before)
    const after = removeApplied(before, navy)

    expect(after.colors).toEqual(['black'])
    expect(after.seasons).toEqual(['summer'])
  })

  it('즐겨찾기 토글을 끈다', () => {
    const before = filters({ favoriteOnly: true })
    const after = removeApplied(before, appliedFilters(before)[0])
    expect(after.favoriteOnly).toBe(false)
  })

  /**
   * 같은 문자열이 여러 축에 앉을 수 있고("M"은 사이즈이면서 핏이다) 항목이 어느 축에서
   * 왔는지를 싣는 것은 지울 때 나머지를 함께 데려가지 않기 위해서다.
   */
  it('다른 축의 같은 값은 지우지 않는다', () => {
    const before = filters({ sizes: ['M'], fits: ['M'] })
    const size = appliedFilters(before).find((entry) => entry.axis === 'sizes')!
    const after = removeApplied(before, size)

    expect(after.sizes).toEqual([])
    expect(after.fits).toEqual(['M'])
  })

  it('입력을 건드리지 않는다', () => {
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

  it('시트가 소유한 모든 축을 비운다', () => {
    expect(activeFilterCount(clearFilters(busy))).toBe(0)
  })

  /**
   * 이 넷은 시트 밖의 컨트롤이 들고 있다 — 검색창, 카테고리 레일, 옷장/처분함 전환.
   * 시트를 초기화하는 것이 그것들에 손을 뻗으면 안 된다.
   */
  it('검색어·카테고리·상태·정렬은 지킨다', () => {
    const cleared = clearFilters(busy)
    expect(cleared.query).toBe('플리스')
    expect(cleared.groupIds).toEqual(['top'])
    expect(cleared.status).toBe('disposed')
    expect(cleared.sort).toBe('title')
  })
})
