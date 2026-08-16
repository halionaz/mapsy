import { COLOR_IDS, type ColorId } from '@/shared/config/colors'
import { SEASON_IDS, type SeasonId } from '@/shared/config/seasons'
import { isSubcategoryId, type SubcategoryId } from '@/shared/config/categories'
import type { Database } from '@/shared/api/database.types'
import type { PhotoEntry } from '../model/photoEntries'
import type { Item, ItemDraft, ItemImage, ItemStatus } from '../model/types'

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

// Derived from the live schema (`pnpm types:gen`) rather than hand-written, so a
// column rename becomes a compile error here instead of a runtime surprise.
export type ItemRow = Database['public']['Tables']['items']['Row']
export type ItemImageRow = Database['public']['Tables']['item_images']['Row']
export type ItemInsert = Database['public']['Tables']['items']['Insert']
export type ItemUpdate = Database['public']['Tables']['items']['Update']
export type ItemImageInsert = Database['public']['Tables']['item_images']['Insert']

const COLOR_SET = new Set<string>(COLOR_IDS)
const SEASON_SET = new Set<string>(SEASON_IDS)

// The array columns are `not null default '{}'`, which the generated row types
// carry through — so these take `string[]`, not `string[] | null`. Values are
// still filtered: the database constrains membership, but a row written by a
// build with a wider palette must not smuggle an unknown id into ColorId.
function toColors(value: string[]): ColorId[] {
  return value.filter((c): c is ColorId => COLOR_SET.has(c))
}

function toSeasons(value: string[]): SeasonId[] {
  return value.filter((s): s is SeasonId => SEASON_SET.has(s))
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
    tags: row.tags,
    status: toStatus(row.status),
    isFavorite: row.is_favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * What an uploaded photo is, minus where it sits.
 *
 * Position is the caller's business: registration numbers photos by their order
 * in the form, `set_item_images` places them among photos that already exist.
 *
 * A type alias rather than an interface, and snake_case rather than the domain's
 * camelCase, for the same reason: this is spread straight into a row or into the
 * RPC's `jsonb` argument, and only an alias carries the implicit index signature
 * `Json` asks for.
 */
export type UploadedImage = {
  id: string
  path: string
  thumb_path: string
  width: number
  height: number
}

/**
 * The array `set_item_images` takes: the form's order, with every picked entry
 * replaced by the row its upload produced.
 *
 * `uploaded` is in the order the picked entries appear, so walking the two
 * together is what puts each new photo where the form put it. Getting this
 * wrong does not fail — it silently stores the photos in a different order than
 * the one on screen, which is the whole thing the screen was for.
 */
export function toImagePayload(
  entries: readonly PhotoEntry[],
  uploaded: readonly UploadedImage[],
): ({ id: string } | UploadedImage)[] {
  let next = 0
  return entries.map((entry) =>
    entry.kind === 'stored' ? { id: entry.image.id } : uploaded[next++],
  )
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
 * The columns a draft writes, shared by insert and update.
 *
 * Blank optional text becomes null rather than an empty string, so "no brand"
 * has one representation instead of two — otherwise filters and `is null`
 * queries have to check for both.
 */
function toItemFields(draft: ItemDraft) {
  return {
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
    // Tags are trimmed and de-duplicated here so the autocomplete derived from
    // the loaded collection doesn't offer "출근용" twice.
    tags: uniqueTags(draft.tags ?? []),
  }
}

export function toItemInsert(draft: ItemDraft, userId: string): ItemInsert {
  return { ...toItemFields(draft), user_id: userId, is_favorite: draft.isFavorite ?? false }
}

/**
 * Writes only what the edit form owns.
 *
 * `user_id` is absent because ownership is fixed at creation — sending it would
 * at best be a no-op and at worst trip the RLS check, and leaving it out of the
 * type is stronger than deleting the key afterwards.
 *
 * `is_favorite` is absent for a different reason: the star lives on the detail
 * screen, not in this form. Including it meant opening the edit screen, starring
 * the item elsewhere, then saving — and silently un-starring it.
 */
export function toItemUpdate(draft: ItemDraft): ItemUpdate {
  return toItemFields(draft)
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
