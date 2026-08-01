/**
 * Domain types mirroring the Supabase schema in PRD §4.1.
 *
 * Keep these in sync with the SQL by hand for now. Once the Supabase project
 * exists, `supabase gen types typescript` can generate the row types and these
 * become thin aliases over the generated ones.
 */

import type { ColorId } from '../shared/constants/colors'
import type { SeasonId } from '../shared/constants/seasons'

/**
 * Sold, donated or discarded garments are hidden rather than deleted, so the
 * purchase history survives. The wardrobe only ever queries `owned`.
 */
export type ItemStatus = 'owned' | 'disposed'

export interface ItemImage {
  id: string
  itemId: string
  /** Storage path of the full-size image (long edge 1280, WebP). */
  path: string
  /** Storage path of the 1:1 cropped thumbnail (400×400, WebP). */
  thumbPath: string
  /** 0 is the cover shown in the grid — reordering is how the cover changes. */
  sortOrder: number
  width: number | null
  height: number | null
}

export interface Item {
  id: string
  userId: string

  title: string
  /** Subcategory id, e.g. `top.tshirt_short`. */
  categoryId: string

  brand: string | null
  size: string | null
  fit: string | null
  /** At most 3; the first is the primary colour shown on the card. */
  colors: ColorId[]
  seasons: SeasonId[]
  /** KRW, whole won. */
  price: number | null
  /** ISO date, `YYYY-MM-DD`. */
  purchasedAt: string | null
  purchasePlace: string | null
  memo: string | null
  tags: string[]

  status: ItemStatus
  isFavorite: boolean

  createdAt: string
  updatedAt: string
}

/** An item joined with its images, which is what the grid and detail view use. */
export interface ItemWithImages extends Item {
  images: ItemImage[]
}

/** Fields the create form collects. Everything past title/category is optional. */
export type ItemDraft = Pick<Item, 'title' | 'categoryId'> &
  Partial<
    Pick<
      Item,
      | 'brand'
      | 'size'
      | 'fit'
      | 'colors'
      | 'seasons'
      | 'price'
      | 'purchasedAt'
      | 'purchasePlace'
      | 'memo'
      | 'tags'
      | 'isFavorite'
    >
  >

export const SORT_OPTIONS = [
  { id: 'recent', label: '최근 등록순' },
  { id: 'price_desc', label: '가격 높은순' },
  { id: 'price_asc', label: '가격 낮은순' },
  { id: 'title', label: '이름순' },
] as const

export type SortId = (typeof SORT_OPTIONS)[number]['id']

/**
 * Active wardrobe filters.
 *
 * Values within one axis are OR'd, and the axes are AND'd together — so
 * `상의 AND (블랙 OR 네이비) AND 여름` (PRD §6.1).
 */
export interface WardrobeFilters {
  query: string
  groupIds: string[]
  categoryIds: string[]
  colors: ColorId[]
  seasons: SeasonId[]
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
  status: 'owned',
  sort: 'recent',
}
