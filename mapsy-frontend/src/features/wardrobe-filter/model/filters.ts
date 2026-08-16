import type { CategoryGroupId, SubcategoryId } from '@/shared/config/categories'
import type { ColorId } from '@/shared/config/colors'
import type { SeasonId } from '@/shared/config/seasons'
import type { ItemStatus } from '@/entities/item'

/** 옷장 필터 상태 — PRD §6.1. */

/**
 * `worn`은 착용 기록이 더한 유일한 축이고, 혼자인 것은 의도다.
 *
 * "많이 입은순"과 "오래 안 입은순"이 함께 초안에 있었고 둘 다 뺐다. 뒤쪽은 이 목록을
 * 뒤집은 것이라 스크롤 한 번이지 두 번째 컨트롤이 아니다. 앞쪽은 횟수를 세는데, 횟수는
 * 기록이 정직하게 주장할 수 없는 빈도를 말한다 — 기록하지 않은 며칠이 진실은 그대로 둔 채
 * 숫자만 움직인다. "마지막으로 언제 입었나"는 더 작은 주장이라 기록의 구멍을 살아남는다.
 */
export const SORT_OPTIONS = [
  { id: 'recent', label: '최근 등록순' },
  { id: 'worn', label: '최근 입은순' },
  { id: 'price_desc', label: '가격 높은순' },
  { id: 'price_asc', label: '가격 낮은순' },
  { id: 'title', label: '이름순' },
] as const

export type SortId = (typeof SORT_OPTIONS)[number]['id']

/** 한 축 안의 값은 OR, 축끼리는 AND — `상의 AND (블랙 OR 네이비) AND 여름`. */
export interface WardrobeFilters {
  query: string
  groupIds: CategoryGroupId[]
  categoryIds: SubcategoryId[]
  colors: ColorId[]
  seasons: SeasonId[]
  /** 자유 문자열 — 프리셋이 카테고리마다 다르고 직접 입력도 허용된다. */
  sizes: string[]
  fits: string[]
  brands: string[]
  tags: string[]
  favoriteOnly: boolean
  status: ItemStatus
  sort: SortId
}

export const EMPTY_FILTERS: WardrobeFilters = {
  query: '',
  groupIds: [],
  categoryIds: [],
  colors: [],
  seasons: [],
  sizes: [],
  fits: [],
  brands: [],
  tags: [],
  favoriteOnly: false,
  // 처분한 옷은 따로 요청하기 전까지 옷장 밖에 있다.
  status: 'owned',
  sort: 'recent',
}
