/**
 * Domain types mirroring the Supabase schema in PRD §4.1.
 *
 * Types only — runtime values belong in `shared/constants` or the feature that
 * owns them, so `import type` stays usable throughout.
 *
 * Keep these in sync with the SQL by hand for now. Once the Supabase project
 * exists, `supabase gen types typescript` can generate the row types and these
 * become thin aliases over the generated ones.
 */

import type { SubcategoryId } from '@/shared/constants/categories'
import type { ColorId } from '@/shared/constants/colors'
import type { SeasonId } from '@/shared/constants/seasons'

/**
 * Sold, donated or discarded garments are hidden rather than deleted, so the
 * purchase history survives. The wardrobe only ever queries `owned`.
 */
export type ItemStatus = 'owned' | 'disposed'

export interface ItemImage {
  id: string
  itemId: string
  /**
   * Denormalised from the parent item. `item_images` carries its own `user_id`
   * because the RLS policy is `user_id = auth.uid()` on the row itself — an
   * insert that omits it is rejected, so it cannot be left off the type.
   */
  userId: string
  /** Storage path of the full-size image (long edge 1280, WebP). */
  path: string
  /** Storage path of the 1:1 cropped thumbnail (400×400, WebP). */
  thumbPath: string
  /** 0 is the cover shown in the grid — reordering is how the cover changes. */
  sortOrder: number
  width: number | null
  height: number | null
  createdAt: string
}

export interface Item {
  id: string
  userId: string

  title: string
  categoryId: SubcategoryId

  brand: string | null
  size: string | null
  fit: string | null
  /** At most MAX_COLORS_PER_ITEM; the first is the primary shown on the card. */
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
