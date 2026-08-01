import { COLOR_IDS, type ColorId } from '@/shared/constants/colors'
import { SEASON_IDS, type SeasonId } from '@/shared/constants/seasons'
import { isSubcategoryId, type SubcategoryId } from '@/shared/constants/categories'
import type { Item, ItemDraft, ItemImage, ItemStatus } from '@/types/item'

/**
 * Translation between Postgres rows (snake_case, loose) and domain objects
 * (camelCase, narrow).
 *
 * Kept pure and separate from the network calls so the mapping — the part with
 * actual decisions in it — can be tested without a database.
 *
 * Reads are defensive. A row may have been written by a different build of the
 * app, so unknown enum members are dropped rather than trusted into a union
 * type that promises they cannot exist.
 */

export interface ItemRow {
  id: string
  user_id: string
  title: string
  category_id: string
  brand: string | null
  size: string | null
  fit: string | null
  colors: string[] | null
  seasons: string[] | null
  price: number | null
  purchased_at: string | null
  purchase_place: string | null
  memo: string | null
  tags: string[] | null
  status: string
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export interface ItemImageRow {
  id: string
  item_id: string
  user_id: string
  path: string
  thumb_path: string
  sort_order: number
  width: number | null
  height: number | null
  created_at: string
}

const COLOR_SET = new Set<string>(COLOR_IDS)
const SEASON_SET = new Set<string>(SEASON_IDS)

function toColors(value: string[] | null): ColorId[] {
  return (value ?? []).filter((c): c is ColorId => COLOR_SET.has(c))
}

function toSeasons(value: string[] | null): SeasonId[] {
  return (value ?? []).filter((s): s is SeasonId => SEASON_SET.has(s))
}

function toStatus(value: string): ItemStatus {
  // Anything unrecognised is treated as still owned — hiding a garment the user
  // still has is a worse failure than showing one they disposed of.
  return value === 'disposed' ? 'disposed' : 'owned'
}

function toCategoryId(value: string): SubcategoryId {
  // The database only validates the group prefix, so a subcategory retired from
  // the app can still appear. Surfacing it under 기타 keeps the item reachable
  // instead of dropping it out of every filter.
  return isSubcategoryId(value) ? value : 'etc.etc'
}

export function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    categoryId: toCategoryId(row.category_id),
    brand: row.brand,
    size: row.size,
    fit: row.fit,
    colors: toColors(row.colors),
    seasons: toSeasons(row.seasons),
    price: row.price,
    purchasedAt: row.purchased_at,
    purchasePlace: row.purchase_place,
    memo: row.memo,
    tags: row.tags ?? [],
    status: toStatus(row.status),
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toItemImage(row: ItemImageRow): ItemImage {
  return {
    id: row.id,
    itemId: row.item_id,
    userId: row.user_id,
    path: row.path,
    thumbPath: row.thumb_path,
    sortOrder: row.sort_order,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  }
}

/**
 * Insert/update payload for a draft.
 *
 * Blank optional text becomes null rather than an empty string, so "no brand"
 * has one representation instead of two — otherwise filters and `is null`
 * queries have to check for both.
 */
export function toItemPayload(
  draft: ItemDraft,
  userId: string,
): Record<string, unknown> {
  return {
    user_id: userId,
    title: draft.title.trim(),
    category_id: draft.categoryId,
    brand: blankToNull(draft.brand),
    size: blankToNull(draft.size),
    fit: blankToNull(draft.fit),
    colors: draft.colors ?? [],
    seasons: draft.seasons ?? [],
    price: draft.price ?? null,
    purchased_at: blankToNull(draft.purchasedAt),
    purchase_place: blankToNull(draft.purchasePlace),
    memo: blankToNull(draft.memo),
    // Tags are trimmed and de-duplicated here so the autocomplete built from
    // `distinct unnest(tags)` doesn't offer "출근용" twice.
    tags: uniqueTags(draft.tags ?? []),
    is_favorite: draft.isFavorite ?? false,
  }
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const tag of tags) {
    const trimmed = tag.trim().replace(/^#/, '')
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}
