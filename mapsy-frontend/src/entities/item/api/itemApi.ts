import { removeObjects, signPaths } from '@/shared/api/storage'
import { getSupabase, STORAGE_BUCKET } from '@/shared/api/supabase'
import { newId } from '@/shared/lib/id'
import type { ProcessedPhoto } from '@/shared/lib/image'
import type { Item, ItemDraft, ItemStatus, WardrobeItem } from '../model/types'
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
 * Reads and updates carry no owner condition: the policies already scope every
 * row to auth.uid(), and repeating that in the client would suggest the security
 * lives here rather than in the database.
 *
 * **Deletes are the exception** — `deleteItem` and the rollback inside
 * `createItem` both add `.eq('user_id', …)`. Not because RLS is doubted, but
 * because those two are the only queries whose mistake cannot be taken back: a
 * `delete` that matches more rows than intended has no undo, so it is worth one
 * redundant predicate. Do not "tidy" them into consistency with the rest.
 */

const ITEM_COLUMNS = '*'
const IMAGE_COLUMNS = '*'

/**
 * Ceilings on the full-collection fetch.
 *
 * PostgREST truncates to its configured `max-rows` silently — a short array, not
 * an error. Setting our own `.limit()` does not reveal that: if the server caps
 * at a smaller number, the response is under our limit and looks complete.
 *
 * `count: 'exact'` is what actually detects it. The response carries the total
 * row count independently of how many rows came back, so comparing the two
 * catches truncation from either source — and incidentally reports what the
 * server's ceiling really is.
 *
 * PRD §8.4 puts the move to server-side filtering at ~1,000 garments, so these
 * sit just past that: reaching one means the client-side approach has been
 * outgrown, not that something broke.
 */
const ITEM_FETCH_LIMIT = 2000
const IMAGE_FETCH_LIMIT = ITEM_FETCH_LIMIT * 5

export async function fetchWardrobe(): Promise<WardrobeItem[]> {
  const supabase = getSupabase()

  const [itemsResult, imagesResult] = await Promise.all([
    supabase
      .from('items')
      .select(ITEM_COLUMNS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(ITEM_FETCH_LIMIT),
    supabase
      .from('item_images')
      .select(IMAGE_COLUMNS, { count: 'exact' })
      .order('sort_order')
      .limit(IMAGE_FETCH_LIMIT),
  ])

  if (itemsResult.error) throw itemsResult.error
  if (imagesResult.error) throw imagesResult.error

  warnIfTruncated(itemsResult.data?.length ?? 0, itemsResult.count, '아이템')
  warnIfTruncated(imagesResult.data?.length ?? 0, imagesResult.count, '사진')

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

function warnIfTruncated(received: number, total: number | null, what: string) {
  if (total == null || received >= total) return
  console.warn(
    `${what} ${total}건 중 ${received}건만 받음. 전량 로드 + 클라이언트 필터링의 한계에 ` +
      '도달했으므로 서버 사이드 필터링으로 전환해야 함 (PRD §8.4).',
  )
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
 * The window is much smaller now, though not zero: if the item row lands and
 * the image rows do not, the same rollback problem applies to the delete below.
 * That failure is reported rather than swallowed, because it is the one case
 * that can still leave a photo-less row behind.
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
      const { error: rollbackError } = await supabase
        .from('items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', userId)
      if (rollbackError) {
        console.warn(
          '사진 없는 아이템 행을 되돌리지 못함. 그리드에 빈 카드로 보일 수 있음:',
          rollbackError.message,
        )
      }
      throw imageError
    }
  } catch (insertError) {
    await removeObjects(pending.paths)
    throw insertError
  }
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

      // allSettled, not all. supabase-js turns a StorageError into `{ error }`
      // but lets anything else through as a rejection — an aborted request, a
      // connection dropped mid-flight — and `Promise.all` rejects on the first
      // of those without waiting for its sibling. If the sibling then lands, its
      // object was never recorded, so the cleanup below walks past it: an orphan
      // in the bucket, which is the single thing this function exists to avoid.
      const [full, thumb] = await Promise.allSettled([
        storage.upload(path, photo.full, { contentType }),
        storage.upload(thumbPath, photo.thumb, { contentType }),
      ])
      const fullError = uploadErrorOf(full)
      const thumbError = uploadErrorOf(thumb)

      // Recorded before the error check: when one of the pair succeeds and the
      // other fails, the successful one still needs cleaning up.
      if (!fullError) paths.push(path)
      if (!thumbError) paths.push(thumbPath)
      if (fullError) throw fullError
      if (thumbError) throw thumbError

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
 * Why one upload failed, however supabase-js chose to report it — returned in
 * `{ error }` for a StorageError, thrown for everything else.
 */
function uploadErrorOf(result: PromiseSettledResult<{ error: unknown }>): unknown {
  if (result.status === 'fulfilled') return result.value.error
  return result.reason ?? new Error('사진 업로드에 실패했어요.')
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

  const { data: deleted, error } = await supabase
    .from('items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
  if (error) throw error

  // PostgREST does not call "matched nothing" an error, so without asking for
  // the rows back a delete that hit none reports success — and the caller acts
  // on it: the card is patched out of the cache, the screen navigates away, and
  // the garment reappears at the next refetch with nothing to explain it. The
  // two predicates above are what make that reachable, and RLS can produce the
  // same empty result on its own. A guard that can miss is a guard whose result
  // has to be read.
  if (!deleted?.length) throw new Error('삭제할 옷을 찾지 못했어요.')

  // Not fatal: the row is gone, which is what was asked for. A leftover object
  // costs quota, and failing here would tell the user the delete did not work.
  await removeObjects(paths)
}
