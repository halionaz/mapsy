import { groupIdOf } from '@/shared/config/categories'
import { matchesQuery } from '@/shared/lib/hangul'
import type { Item } from '@/entities/item'
import type { WearSummary } from '@/entities/wear'
import type { SortId, WardrobeFilters } from '../model/filters'

/**
 * 옷 자신의 컬럼 말고 이 파일이 더 필요로 하는 것.
 *
 * `{ lastWornOn: string | null }`을 다시 적지 않고 `Pick`으로 가져온다 — 그 필드는 착용
 * 엔티티의 것이고, 여기 복사본을 두면 언젠가 어긋난다. 특히 nullable이 중요하다.
 * `worn` 비교 함수는 null이 "오래전"이 아니라 "한 번도"라는 위에 지어져 있다.
 */
export type SortableItem = Item & Pick<WearSummary, 'lastWornOn'>

/**
 * 클라이언트 필터링·정렬 — PRD §6.1, §8.4.
 *
 * 옷장 전체가 메모리에 있어서 타이핑 한 글자, 칩 한 번마다 왕복 없이 돌아간다.
 * 순수하게 두는 것은 의도다 — 사용자가 보는 것을 정하는 로직이고, DB 없이 검사할 수 있어야 한다.
 *
 * 한 축 안의 값은 OR, 축끼리는 AND다. 블랙과 네이비를 고르면 결과가 넓어지고 여름을
 * 더하면 좁아진다. 반대로 만들면 다중 선택이 고장 난 것처럼 느껴진다.
 */

function hasAny<T>(itemValues: readonly T[], selected: readonly T[]): boolean {
  if (selected.length === 0) return true
  return itemValues.some((value) => selected.includes(value))
}

function includesOrEmpty(value: string | null, selected: readonly string[]): boolean {
  if (selected.length === 0) return true
  return value !== null && selected.includes(value)
}

/** 사람이 검색될 것이라 기대하는 필드 — 이름, 브랜드, 메모, 태그. */
function matchesSearch(item: Item, query: string): boolean {
  if (!query.trim()) return true
  const haystacks = [item.title, item.brand, item.memo, ...item.tags]
  return haystacks.some((text) => text != null && matchesQuery(text, query))
}

function compare(a: SortableItem, b: SortableItem, sort: SortId): number {
  switch (sort) {
    case 'recent':
      return b.createdAt.localeCompare(a.createdAt)
    case 'title':
      return a.title.localeCompare(b.title, 'ko')
    case 'worn': {
      // 두 층이고, 두 번째가 이 축의 요점이다.
      //
      // 입은 옷이 먼저, 최근이 위. 한 번도 안 입은 옷은 그 뒤에 최근 등록순으로 —
      // 그래서 구획의 맨 아래가 "오래전에 등록하고 한 번도 안 입은 옷"이 된다.
      //
      // `lastWornOn ?? createdAt`은 반대쪽 끝에서 틀린다. 오늘 아침 등록하고 안 입은 옷이
      // 어제 실제로 입은 셔츠를 제치고 최근 입은순의 맨 위에 온다.
      if (a.lastWornOn == null && b.lastWornOn == null) {
        return b.createdAt.localeCompare(a.createdAt)
      }
      if (a.lastWornOn == null) return 1
      if (b.lastWornOn == null) return -1

      // 같은 날 동점은 예외가 아니라 평범한 경우다 — 하루치 옷이 전부 한 날짜를 단다.
      // 등록순으로 흘려보내면 비교 함수가 전순서가 되고, 답이 캐시 배열의 우연한 순서에
      // 맡겨지지 않는다.
      const byDay = b.lastWornOn.localeCompare(a.lastWornOn)
      return byDay !== 0 ? byDay : b.createdAt.localeCompare(a.createdAt)
    }
    case 'price_desc':
    case 'price_asc': {
      // 가격 없는 옷은 어느 방향이든 바닥으로 — 빠진 가격은 0이 아니라 모름이다.
      if (a.price == null && b.price == null) return b.createdAt.localeCompare(a.createdAt)
      if (a.price == null) return 1
      if (b.price == null) return -1
      return sort === 'price_desc' ? b.price - a.price : a.price - b.price
    }
  }
}

export function applyFilters<T extends SortableItem>(
  items: readonly T[],
  filters: WardrobeFilters,
): T[] {
  const matched = items.filter((item) => {
    if (item.status !== filters.status) return false
    if (filters.favoriteOnly && !item.isFavorite) return false

    // "대분류가 없는 id"를 위한 가지는 없다. `Item.categoryId`는 `SubcategoryId`이고
    // `groupIdOf`가 전순함수로 답한다. 여기 있던 가드는 조심처럼 읽혔지만 뜻할 수 있는
    // 것은 "그 옷을 감춘다"뿐이었고, `mapRow`가 이미 경계에서 기타로 접는 경우였다.
    if (filters.groupIds.length > 0 && !filters.groupIds.includes(groupIdOf(item.categoryId))) {
      return false
    }

    if (filters.categoryIds.length > 0 && !filters.categoryIds.includes(item.categoryId)) {
      return false
    }

    if (!hasAny(item.colors, filters.colors)) return false
    if (!hasAny(item.seasons, filters.seasons)) return false
    if (!hasAny(item.tags, filters.tags)) return false

    if (!includesOrEmpty(item.size, filters.sizes)) return false
    if (!includesOrEmpty(item.fit, filters.fits)) return false
    if (!includesOrEmpty(item.brand, filters.brands)) return false

    return matchesSearch(item, filters.query)
  })

  // 정렬 전에 복사한다 — 입력이 쿼리 캐시의 배열이라, 그 자리에서 정렬하면 그것을
  // 읽는 다른 모두의 순서가 바뀐다.
  return [...matched].sort((a, b) => compare(a, b, filters.sort))
}
