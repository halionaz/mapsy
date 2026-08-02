import type {
  CategoryGroupId,
  SubcategoryId,
} from '@/shared/config/categories'
import type { ColorId } from '@/shared/config/colors'
import type { SeasonId } from '@/shared/config/seasons'
import type { ItemStatus } from '@/entities/item'

/**
 * Wardrobe filter state — PRD §6.1.
 *
 * Lives with the filters feature rather than in `types/`, because the default
 * value is a runtime decision this feature owns, not a description of a database
 * row.
 */

export const SORT_OPTIONS = [
  { id: 'recent', label: '최근 등록순' },
  { id: 'price_desc', label: '가격 높은순' },
  { id: 'price_asc', label: '가격 낮은순' },
  { id: 'title', label: '이름순' },
] as const

export type SortId = (typeof SORT_OPTIONS)[number]['id']

/**
 * Values within one axis are OR'd, and the axes are AND'd together — so
 * `상의 AND (블랙 OR 네이비) AND 여름`.
 */
export interface WardrobeFilters {
  query: string
  groupIds: CategoryGroupId[]
  categoryIds: SubcategoryId[]
  colors: ColorId[]
  seasons: SeasonId[]
  /** Free-form: presets vary per category and free input is allowed. */
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
  // Disposed garments stay out of the wardrobe until explicitly asked for.
  status: 'owned',
  sort: 'recent',
}
