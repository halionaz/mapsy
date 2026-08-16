import { describe, expect, it } from 'vitest'
import { applyFilters, type SortableItem } from './applyFilters'
import { EMPTY_FILTERS, type WardrobeFilters } from '../model/filters'

function item(overrides: Partial<SortableItem> & { id: string }): SortableItem {
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
    // 기본값을 "한 번도 안 입음"으로 두는 것은 이 파일 대부분이 그것에 무관해야
    // 하기 때문이다 — `worn` 정렬이 아닌 모든 경우가 여기에 영향받지 않아야 한다.
    lastWornOn: null,
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
const ids = (result: SortableItem[]) => result.map((i) => i.id)

describe('applyFilters', () => {
  it('기본으로는 보유 중인 옷만 보여준다', () => {
    expect(ids(applyFilters(all, filters()))).toEqual(['a', 'b'])
  })

  it('대신 처분한 옷을 보여줄 수도 있다', () => {
    expect(ids(applyFilters(all, filters({ status: 'disposed' })))).toEqual(['c'])
  })

  it('한 축 안의 값은 OR로 묶는다', () => {
    const result = applyFilters(all, filters({ colors: ['navy', 'black'] }))
    expect(ids(result)).toEqual(['a', 'b'])
  })

  it('축끼리는 AND로 묶는다', () => {
    // 네이비 OR 블랙이 a+b로 좁히고, 거기에 여름이 b만 남긴다.
    const result = applyFilters(all, filters({ colors: ['navy', 'black'], seasons: ['summer'] }))
    expect(ids(result)).toEqual(['b'])
  })

  it('대분류로 거른다', () => {
    expect(ids(applyFilters(all, filters({ groupIds: ['outer'] })))).toEqual(['a'])
  })

  it('정확한 소분류로 거른다', () => {
    expect(ids(applyFilters(all, filters({ categoryIds: ['top.tshirt_short'] })))).toEqual(['b'])
  })

  it('사이즈·핏·브랜드로 거른다', () => {
    expect(ids(applyFilters(all, filters({ sizes: ['M'] })))).toEqual(['a'])
    expect(ids(applyFilters(all, filters({ brands: ['유니클로'] })))).toEqual(['b'])
  })

  it('그 축을 거를 때 값이 null인 옷은 뺀다', () => {
    // blackTee에는 핏이 없으므로 핏 필터가 실수로 그것을 남기면 안 된다.
    expect(ids(applyFilters(all, filters({ fits: ['오버'] })))).toEqual([])
  })

  it('즐겨찾기로 거른다', () => {
    const favourite = { ...blackTee, isFavorite: true }
    const result = applyFilters([navyJacket, favourite], filters({ favoriteOnly: true }))
    expect(ids(result)).toEqual(['b'])
  })

  it('이름·브랜드·메모·태그를 검색한다', () => {
    expect(ids(applyFilters(all, filters({ query: '반팔' })))).toEqual(['b'])
    expect(ids(applyFilters(all, filters({ query: '유니클로' })))).toEqual(['b'])
    expect(ids(applyFilters(all, filters({ query: '출근용' })))).toEqual(['a'])
  })

  it('searches by 초성', () => {
    expect(ids(applyFilters(all, filters({ query: 'ㄴㅅㅍ' })))).toEqual(['a'])
  })

  it('기본은 최신 등록 먼저다', () => {
    expect(ids(applyFilters(all, filters()))).toEqual(['a', 'b'])
  })

  it('가격을 양방향으로 정렬한다', () => {
    expect(ids(applyFilters(all, filters({ sort: 'price_asc' })))).toEqual(['b', 'a'])
    expect(ids(applyFilters(all, filters({ sort: 'price_desc' })))).toEqual(['a', 'b'])
  })

  it('가격 없는 옷은 방향과 무관하게 바닥으로 가라앉는다', () => {
    // 빠진 가격은 공짜가 아니라 모름이다 — "가장 싼"을 차지하면 안 된다.
    const noPrice = item({ id: 'd', title: '가격 미상', createdAt: '2026-04-01T00:00:00Z' })
    const list = [navyJacket, blackTee, noPrice]
    expect(ids(applyFilters(list, filters({ sort: 'price_asc' })))).toEqual(['b', 'a', 'd'])
    expect(ids(applyFilters(list, filters({ sort: 'price_desc' })))).toEqual(['a', 'b', 'd'])
  })

  it('이름을 한국어 순서로 정렬한다', () => {
    expect(ids(applyFilters(all, filters({ sort: 'title' })))).toEqual(['b', 'a'])
  })

  it('마지막으로 입은 순, 최근이 먼저', () => {
    const list = [
      item({ id: 'old', lastWornOn: '2026-05-01' }),
      item({ id: 'new', lastWornOn: '2026-07-20' }),
      item({ id: 'mid', lastWornOn: '2026-06-11' }),
    ]
    expect(ids(applyFilters(list, filters({ sort: 'worn' })))).toEqual(['new', 'mid', 'old'])
  })

  it('한 번도 안 입은 옷을 입은 옷 전부보다 아래로 가라앉힌다', () => {
    // 이 축의 요점 전부다 — 오늘 아침 등록하고 안 입은 옷이 몇 달 전에 실제로 입은
    // 셔츠를 제치면 안 된다. 기각된 모양인 `lastWornOn ?? createdAt`은 여기서
    // `fresh`를 맨 앞에 놓는다.
    const list = [
      item({ id: 'fresh', createdAt: '2026-08-14T00:00:00Z' }),
      item({ id: 'worn', lastWornOn: '2026-03-02', createdAt: '2026-01-01T00:00:00Z' }),
    ]
    expect(ids(applyFilters(list, filters({ sort: 'worn' })))).toEqual(['worn', 'fresh'])
  })

  it('한 번도 안 입은 것은 등록순으로, 오래된 것이 마지막', () => {
    // 목록의 바닥이 "내가 뭘 방치했나"에 대한 답이라, 오래전에 등록하고 한 번도 안 입은
    // 옷이 거기 온다.
    const list = [
      item({ id: 'ancient', createdAt: '2026-01-05T00:00:00Z' }),
      item({ id: 'recent', createdAt: '2026-08-01T00:00:00Z' }),
    ]
    expect(ids(applyFilters(list, filters({ sort: 'worn' })))).toEqual(['recent', 'ancient'])
  })

  it('같은 날 동점은 캐시 순서가 아니라 등록순으로 가른다', () => {
    // 하루치 옷이 전부 한 날짜를 달므로 평범한 경우다. 기대와 반대 순서로 건네므로,
    // 여기서 0을 돌려주는 비교 함수는 정렬이 안정적이라는 이유만으로 통과한다.
    const list = [
      item({ id: 'older', lastWornOn: '2026-08-10', createdAt: '2026-02-01T00:00:00Z' }),
      item({ id: 'newer', lastWornOn: '2026-08-10', createdAt: '2026-04-01T00:00:00Z' }),
    ]
    expect(ids(applyFilters(list, filters({ sort: 'worn' })))).toEqual(['newer', 'older'])
  })

  it('입력 배열을 바꾸거나 재정렬하지 않는다', () => {
    const input = [blackTee, navyJacket]
    const before = ids(input)
    applyFilters(input, filters({ sort: 'title' }))
    expect(ids(input)).toEqual(before)
  })
})
