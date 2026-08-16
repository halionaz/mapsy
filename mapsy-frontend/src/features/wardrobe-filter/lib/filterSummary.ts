import { categoryLabel, type SubcategoryId } from '@/shared/config/categories'
import { colorLabel, type ColorId } from '@/shared/config/colors'
import { seasonLabel, type SeasonId } from '@/shared/config/seasons'
import { EMPTY_FILTERS, type WardrobeFilters } from '../model/filters'

/**
 * 필터 시트가 무엇을 요청받았는지를, 헤더가 그리고 하나씩 지울 수 있는 목록으로.
 *
 * `groupIds`가 일부러 빠져 있다. 격자 위 카테고리 레일이 이미 그 선택을 켜진 칩으로
 * 보여주므로, 요약 행에서 되풀이하면 필터 하나를 끄는 자리가 둘이 된다.
 *
 * `query`와 `sort`도 이 뜻의 필터가 아니다 — 하나는 검색창이 들고 있고, 다른 하나는
 * 지우는 게 아니라 재정렬한다. `status`는 이 화면에서 닿지 않는다.
 */

/**
 * `WardrobeFilters`의 축 중 값 목록으로 지울 수 있는 것들 — *더하기*로 정한다.
 * 예외 목록에 없어서가 아니라 문자열 목록을 담고 있어서 축이 된다.
 *
 * 방향이 요점이다. 빼기로 정하면 새로 생긴 스칼라 필드가 기본적으로 축이 되어 글자 단위로
 * 걸어지고, 그중 하나를 지울 때 `removeApplied`의 배열 캐스트에서 던진다.
 *
 * `groupIds`만 의도적 예외다 — 목록이지만 격자 위 레일이 이미 보여주고 지운다.
 * `NonNullable`은 `string[] | null` 필드가 null 가지 하나 때문에 조용히 빠지는 것을 막는다.
 */
type StringListKey<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends readonly string[] ? K : never
}[keyof T]

type ListAxis = Exclude<StringListKey<WardrobeFilters>, 'groupIds'>

export type FilterAxis = ListAxis | 'favoriteOnly'

export interface AppliedFilter {
  /** 렌더 사이에 안정적이고 유일하다 — 두 축이 같은 문자열을 담을 수 있다. */
  key: string
  label: string
  axis: FilterAxis
  value?: string
}

/** 각 축이 값 하나를 어떻게 그리는지. 선언 순서가 칩 순서다. */
const AXIS_LABELS: Record<ListAxis, (value: string) => string> = {
  categoryIds: (value) => categoryLabel(value as SubcategoryId),
  colors: (value) => colorLabel(value as ColorId),
  seasons: (value) => seasonLabel(value as SeasonId),
  sizes: (value) => value,
  fits: (value) => value,
  brands: (value) => value,
  tags: (value) => `#${value}`,
}

const LIST_AXES = Object.keys(AXIS_LABELS) as ListAxis[]

export function appliedFilters(filters: WardrobeFilters): AppliedFilter[] {
  const applied: AppliedFilter[] = []

  for (const axis of LIST_AXES) {
    for (const value of filters[axis]) {
      applied.push({ key: `${axis}:${value}`, label: AXIS_LABELS[axis](value), axis, value })
    }
  }

  if (filters.favoriteOnly) {
    applied.push({ key: 'favoriteOnly', label: '즐겨찾기', axis: 'favoriteOnly' })
  }

  return applied
}

/** 켜진 축·값의 수. 필터 버튼의 배지가 쓴다. */
export function activeFilterCount(filters: WardrobeFilters): number {
  return appliedFilters(filters).length
}

export function removeApplied(filters: WardrobeFilters, applied: AppliedFilter): WardrobeFilters {
  if (applied.axis === 'favoriteOnly') return { ...filters, favoriteOnly: false }

  // 목록 축의 원소 타입이 제각각이라(`ColorId[]`, `SeasonId[]`, `string[]`) 하나의
  // `filter` 호출이 전부를 덮는 시그니처가 없다. `string[]`으로 넓히는 것이 캐스트의
  // 전부다 — 지우는 값은 바로 그 배열에서 나온 것이다.
  const remaining = (filters[applied.axis] as readonly string[]).filter(
    (value) => value !== applied.value,
  )
  return { ...filters, [applied.axis]: remaining }
}

/**
 * 시트가 소유한 축을 전부 비우고 나머지는 그대로 둔다.
 *
 * 빈 배열을 하나씩 넣지 않고 `EMPTY_FILTERS`에서 펼치므로, 타입에 축이 추가되면 아무도
 * 기억하지 않아도 여기서 비워진다. 살아남아야 하는 넷만 한 번 이름을 부른다.
 */
export function clearFilters(filters: WardrobeFilters): WardrobeFilters {
  return {
    ...EMPTY_FILTERS,
    query: filters.query,
    groupIds: filters.groupIds,
    status: filters.status,
    sort: filters.sort,
  }
}
