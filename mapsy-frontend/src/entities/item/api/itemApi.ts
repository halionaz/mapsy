import { removeObjects, settledError, signPaths } from '@/shared/api/storage'
import { getSupabase, STORAGE_BUCKET } from '@/shared/api/supabase'
import { warnIfTruncated } from '@/shared/api/warnIfTruncated'
import { newId } from '@/shared/lib/id'
import type { ProcessedPhoto } from '@/shared/lib/image'
import type { PhotoEntry } from '../model/photoEntries'
import type {
  Item,
  ItemDraft,
  ItemImage,
  ItemStatus,
  ItemWithImages,
  WardrobeItem,
} from '../model/types'
import {
  toImagePayload,
  toItem,
  toItemImage,
  toItemInsert,
  toItemUpdate,
  type UploadedImage,
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
 * Ceilings on the full-collection fetch. `warnIfTruncated` explains what the
 * `count: 'exact'` beside each one is for.
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

/**
 * The cover is the lowest sort_order, not literally 0.
 *
 * `set_item_images` numbers by position so the two are normally the same, but
 * reading it as "position 0 or nothing" turns any gap — an older row, a
 * half-applied change — into a card with photos and a blank thumbnail.
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

  const { uploaded, paths } = await uploadPhotos(itemId, userId, photos)

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
        .insert(
          uploaded.map((image, index) => ({
            ...image,
            item_id: itemId,
            user_id: userId,
            sort_order: index,
          })),
        )
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
    await removeObjects(paths)
    throw insertError
  }
}

/**
 * Uploads every photo and returns what will describe them.
 *
 * Writes nothing to the database — the caller does, so that a failure here
 * leaves no trace at all. Objects are tracked as they land, and a failure
 * part-way through removes the ones already written rather than orphaning them.
 */
async function uploadPhotos(
  itemId: string,
  userId: string,
  photos: readonly ProcessedPhoto[],
): Promise<{ uploaded: UploadedImage[]; paths: string[] }> {
  const storage = getSupabase().storage.from(STORAGE_BUCKET)
  const uploaded: UploadedImage[] = []
  const paths: string[] = []

  try {
    for (const photo of photos) {
      const imageId = newId()
      const base = `${userId}/${itemId}/${imageId}`
      const path = `${base}.${photo.ext}`
      const thumbPath = `${base}_thumb.${photo.ext}`
      const contentType = contentTypeOf(photo.ext)

      // Recorded before either upload is attempted, not after one reports
      // success. A request that fails may still have left its object behind —
      // an aborted or dropped connection is this end giving up, not the server
      // rolling back — and a path that was never recorded is one the cleanup
      // below walks straight past. Removing an object that does not exist costs
      // nothing; leaving one that does is the orphan this function exists to
      // prevent.
      paths.push(path, thumbPath)

      // allSettled, not all. A failed upload usually resolves into `{ error }`
      // rather than rejecting (see `settledError`), but the rejection path is
      // real for anything supabase-js does not recognise — and `Promise.all`
      // rejects on the first of those without waiting for its sibling, so a
      // sibling that lands afterwards would go unseen.
      const [full, thumb] = await Promise.allSettled([
        storage.upload(path, photo.full, { contentType }),
        storage.upload(thumbPath, photo.thumb, { contentType }),
      ])
      const fullError = settledError(full)
      const thumbError = settledError(thumb)
      if (fullError !== null) throw fullError
      if (thumbError !== null) throw thumbError

      uploaded.push({
        id: imageId,
        path,
        thumb_path: thumbPath,
        width: photo.width,
        height: photo.height,
      })
    }

    return { uploaded, paths }
  } catch (uploadError) {
    await removeObjects(paths)
    throw uploadError
  }
}

/**
 * Rewrites an item's photos to match `entries`: uploads the ones picked in the
 * form, drops the stored ones the form let go of, and puts what is left in the
 * order given.
 *
 * All three land in one database call because they cannot be separated. Each
 * PostgREST request is its own transaction, and the `sort_order` CHECK is
 * immediate, so a five-photo item has no free position to insert into until
 * something has been deleted — split across requests, the deletion commits on
 * its own and a save that then fails has taken photos away without adding any.
 * `supabase/migrations/20260816000001_set_item_images.sql` carries the argument.
 *
 * Storage is the part that cannot be in the transaction, so it is ordered around
 * it: uploads go first (an unreferenced object is waste, a missing one is a
 * broken image), and the objects the rewrite orphaned are removed only once it
 * has committed.
 */
export async function setItemPhotos(
  item: ItemWithImages,
  entries: readonly PhotoEntry[],
): Promise<{ images: ItemImage[]; coverUrl: string | null }> {
  const picked = entries.flatMap((entry) => (entry.kind === 'picked' ? [entry.photo] : []))
  const { uploaded, paths } = await uploadPhotos(item.id, item.userId, picked)

  const { data, error, status } = await getSupabase().rpc('set_item_images', {
    p_item_id: item.id,
    p_images: toImagePayload(entries, uploaded),
  })

  if (error) {
    // Only when the database answered. A rejected call rolls back whole, so
    // nothing refers to these objects and they are pure waste. A request that
    // never got an answer is the other case: it may have committed with the
    // response lost on the way back, and removing the objects then leaves rows
    // rendering broken images — which is the direction `deleteItem` orders
    // itself to avoid. Orphans are recoverable; missing files are not.
    // Measured against supabase-js 2.111.0: a fetch that never answered
    // resolves with `status: 0`, an answered rejection with the real HTTP code.
    if (status !== 0) await removeObjects(paths)
    throw error
  }

  const images = (data ?? []).map(toItemImage)

  // What to clean up comes from what came back, not from what the form asked
  // for: the form says what to keep, the server says what is left. A photo added
  // on another device since this screen loaded is deleted by the rewrite and its
  // paths were never ours to name — that leaves an orphan, which is the
  // recoverable side of the same trade.
  const kept = new Set(images.map((image) => image.id))
  const dropped = item.images.filter((image) => !kept.has(image.id))
  await removeObjects(dropped.flatMap((image) => [image.path, image.thumbPath]))

  // Signing can fail on its own, and it throws — by then the rewrite has
  // committed, so the screen would report a failure for a save that landed.
  // Left as the other two signing call sites have it: a retry is convergent
  // here (the next attempt states the whole list again, over whatever the last
  // one wrote), and the alternative is patching the grid with a cover URL that
  // could not be signed, which is a blank card for a garment that has photos.
  const cover = coverOf(images)
  const signed = await signPaths(cover ? [cover.thumbPath] : [])

  return { images, coverUrl: cover ? (signed.get(cover.thumbPath) ?? null) : null }
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
