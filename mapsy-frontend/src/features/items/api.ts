import { getSupabase, STORAGE_BUCKET } from '@/shared/lib/supabase'
import { newId } from '@/shared/lib/id'
import type { ProcessedPhoto } from '@/shared/lib/image'
import type { Item, ItemDraft, ItemStatus, ItemWithImages } from '@/types/item'
import {
  toItem,
  toItemImage,
  toItemInsert,
  toItemUpdate,
  type ItemImageInsert,
} from './mapRow'

/**
 * Supabase access for the wardrobe.
 *
 * No RLS filtering appears in these queries: the policies already scope every
 * row to auth.uid(), and repeating the condition in the client would suggest the
 * security lives here rather than in the database.
 */

const ITEM_COLUMNS = '*'
const IMAGE_COLUMNS = '*'

/**
 * How long a thumbnail URL stays valid. The bucket is private, so grid images
 * are signed rather than public. A day is long enough that a session left open
 * overnight still renders, and short enough that a leaked URL expires.
 */
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24

/** An item plus a ready-to-render URL for its cover. */
export interface WardrobeItem extends ItemWithImages {
  /** Signed thumbnail URL for the cover photo, or null while none exists. */
  coverUrl: string | null
}

export async function fetchWardrobe(): Promise<WardrobeItem[]> {
  const supabase = getSupabase()

  const [itemsResult, imagesResult] = await Promise.all([
    supabase.from('items').select(ITEM_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('item_images').select(IMAGE_COLUMNS).order('sort_order'),
  ])

  if (itemsResult.error) throw itemsResult.error
  if (imagesResult.error) throw imagesResult.error

  const imagesByItem = new Map<string, ReturnType<typeof toItemImage>[]>()
  for (const row of imagesResult.data ?? []) {
    const image = toItemImage(row)
    const list = imagesByItem.get(image.itemId)
    if (list) list.push(image)
    else imagesByItem.set(image.itemId, [image])
  }

  const items = (itemsResult.data ?? []).map((row) => ({
    ...toItem(row),
    images: imagesByItem.get(row.id) ?? [],
  }))

  // One signing call for every cover rather than one per item — the round trips
  // are what cost, not the number of paths.
  const coverPaths = items
    .map((item) => coverOf(item.images)?.thumbPath)
    .filter((path): path is string => Boolean(path))

  const signed = await signPaths(coverPaths)

  return items.map((item) => {
    const cover = coverOf(item.images)
    return { ...item, coverUrl: cover ? (signed.get(cover.thumbPath) ?? null) : null }
  })
}

/**
 * The cover is the lowest sort_order, not literally 0.
 *
 * `delete_item_image` renumbers to a contiguous range so the two are normally
 * the same, but reading it as "position 0 or nothing" turns any gap — an older
 * row, a half-applied change — into a card with photos and a blank thumbnail.
 */
function coverOf<T extends { sortOrder: number }>(images: T[]): T | undefined {
  return images.reduce<T | undefined>(
    (lowest, image) => (!lowest || image.sortOrder < lowest.sortOrder ? image : lowest),
    undefined,
  )
}

/** Signs a batch of storage paths, returning path → URL for the ones that worked. */
export async function signPaths(paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (paths.length === 0) return result

  const { data, error } = await getSupabase()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS)

  if (error) throw error

  for (const entry of data ?? []) {
    // createSignedUrls reports per-path failures inline instead of throwing, so
    // a single missing object doesn't blank out the whole grid.
    if (entry.signedUrl && entry.path) result.set(entry.path, entry.signedUrl)
  }
  return result
}

function contentTypeOf(ext: ProcessedPhoto['ext']): string {
  return ext === 'webp' ? 'image/webp' : 'image/jpeg'
}

/**
 * Creates an item and uploads its photos.
 *
 * Photos go up **before** the row. The item id is generated client-side so the
 * storage paths can be built without the database having seen anything yet.
 *
 * The previous order — insert, upload, delete-on-failure — left a ghost behind
 * whenever the rollback failed too. That is not a rare pairing: the usual reason
 * an upload fails is that the network went away, which is also the reason the
 * rollback fails. The result was a photo-less row that the grid renders as a
 * blank card with no way to tell what it refers to.
 *
 * Uploading first means a failure anywhere leaves nothing in the database at
 * all, and `uploadPhotos` removes whatever objects it already wrote.
 */
export async function createItem(
  draft: ItemDraft,
  photos: ProcessedPhoto[],
  userId: string,
): Promise<WardrobeItem> {
  const supabase = getSupabase()
  const itemId = newId()

  const pending = await uploadPhotos(itemId, userId, photos)

  try {
    const { data, error } = await supabase
      .from('items')
      .insert({ ...toItemInsert(draft, userId), id: itemId })
      .select(ITEM_COLUMNS)
      .single()
    if (error) throw error

    const item = toItem(data)

    try {
      const { data: imageRows, error: imageError } = await supabase
        .from('item_images')
        .insert(pending.rows)
        .select(IMAGE_COLUMNS)
      if (imageError) throw imageError

      const images = (imageRows ?? []).map(toItemImage)
      const cover = coverOf(images)
      const signed = await signPaths(cover ? [cover.thumbPath] : [])

      return {
        ...item,
        images,
        coverUrl: cover ? (signed.get(cover.thumbPath) ?? null) : null,
      }
    } catch (imageError) {
      // The row exists but has no photos, which is the state this ordering is
      // meant to prevent — take it back out.
      await supabase.from('items').delete().eq('id', itemId).eq('user_id', userId)
      throw imageError
    }
  } catch (insertError) {
    await removeObjects(pending.paths)
    throw insertError
  }
}

/** Best-effort storage cleanup; never masks the error that triggered it. */
async function removeObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await getSupabase().storage.from(STORAGE_BUCKET).remove(paths)
  if (error) console.warn('스토리지 정리 실패, 고아 객체가 남았을 수 있음:', error.message)
}

/**
 * Uploads every photo and returns the rows that will describe them.
 *
 * Writes nothing to the database — the caller inserts, so that a failure here
 * leaves no trace at all. Objects are tracked as they land, and a failure
 * part-way through removes the ones already written rather than orphaning them.
 */
async function uploadPhotos(
  itemId: string,
  userId: string,
  photos: ProcessedPhoto[],
): Promise<{ rows: ItemImageInsert[]; paths: string[] }> {
  const storage = getSupabase().storage.from(STORAGE_BUCKET)
  const rows: ItemImageInsert[] = []
  const paths: string[] = []

  try {
    for (const [index, photo] of photos.entries()) {
      const imageId = newId()
      const base = `${userId}/${itemId}/${imageId}`
      const path = `${base}.${photo.ext}`
      const thumbPath = `${base}_thumb.${photo.ext}`
      const contentType = contentTypeOf(photo.ext)

      const [full, thumb] = await Promise.all([
        storage.upload(path, photo.full, { contentType }),
        storage.upload(thumbPath, photo.thumb, { contentType }),
      ])
      // Recorded before the error check: when one of the pair succeeds and the
      // other fails, the successful one still needs cleaning up.
      if (!full.error) paths.push(path)
      if (!thumb.error) paths.push(thumbPath)
      if (full.error) throw full.error
      if (thumb.error) throw thumb.error

      rows.push({
        id: imageId,
        item_id: itemId,
        user_id: userId,
        path,
        thumb_path: thumbPath,
        sort_order: index,
        width: photo.width,
        height: photo.height,
      })
    }

    return { rows, paths }
  } catch (uploadError) {
    await removeObjects(paths)
    throw uploadError
  }
}

/**
 * Rewrites photo order. `imageIds` must list every photo of the item, cover
 * first.
 *
 * Goes through a database function rather than a series of updates: each
 * PostgREST request is its own transaction, so two updates would commit
 * separately and the first one would violate the unique constraint on
 * (item_id, sort_order). Parking a row at a sentinel value is no escape either —
 * the sort_order CHECK is immediate and cannot be deferred.
 */
export async function reorderItemImages(itemId: string, imageIds: string[]): Promise<void> {
  const { error } = await getSupabase().rpc('reorder_item_images', {
    p_item_id: itemId,
    p_image_ids: imageIds,
  })
  if (error) throw error
}

/**
 * Deletes one photo and closes the gap in sort_order.
 *
 * The row goes first, then the objects — the opposite of `deleteItem`, and for
 * the opposite reason. Here the caller already holds the paths, so nothing is
 * lost by removing the row first, and a row that outlived its file would render
 * as a broken image.
 */
export async function deleteItemImage(
  imageId: string,
  paths: { path: string; thumbPath: string },
): Promise<void> {
  const { error } = await getSupabase().rpc('delete_item_image', { p_image_id: imageId })
  if (error) throw error

  await removeObjects([paths.path, paths.thumbPath])
}

export async function updateItem(id: string, draft: ItemDraft): Promise<Item> {
  const { data, error } = await getSupabase()
    .from('items')
    .update(toItemUpdate(draft))
    .eq('id', id)
    .select(ITEM_COLUMNS)
    .single()

  if (error) throw error
  return toItem(data)
}

export async function setFavorite(id: string, isFavorite: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from('items')
    .update({ is_favorite: isFavorite })
    .eq('id', id)
  if (error) throw error
}

export async function setStatus(id: string, status: ItemStatus): Promise<void> {
  const { error } = await getSupabase().from('items').update({ status }).eq('id', id)
  if (error) throw error
}

/**
 * Deletes an item, its image rows and its storage objects.
 *
 * Paths are read first, then the row goes, then the objects.
 *
 * Emptying storage first looks tidier — the cascade takes the paths with it, so
 * they have to be captured beforehand either way — but it fails in the worse
 * direction. If the objects are removed and the row delete then fails, the
 * photos are gone for good and the item is left rendering broken images. The
 * other order can only leave orphaned objects, and those are recoverable: the
 * bucket can be listed and reconciled against the rows.
 */
export async function deleteItem(id: string, userId: string): Promise<void> {
  const supabase = getSupabase()

  const { data, error: listError } = await supabase
    .from('item_images')
    .select('path, thumb_path')
    .eq('item_id', id)
  if (listError) throw listError

  const paths = (data ?? []).flatMap((row) => [row.path, row.thumb_path])

  const { error } = await supabase.from('items').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error

  // Not fatal: the row is gone, which is what was asked for. A leftover object
  // costs quota, and failing here would tell the user the delete did not work.
  await removeObjects(paths)
}
