import { getSupabase, STORAGE_BUCKET } from '@/shared/lib/supabase'
import type { ProcessedPhoto } from '@/shared/lib/image'
import type { Item, ItemDraft, ItemStatus, ItemWithImages } from '@/types/item'
import {
  toItem,
  toItemImage,
  toItemPayload,
  type ItemImageRow,
  type ItemRow,
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
  for (const row of (imagesResult.data ?? []) as ItemImageRow[]) {
    const image = toItemImage(row)
    const list = imagesByItem.get(image.itemId)
    if (list) list.push(image)
    else imagesByItem.set(image.itemId, [image])
  }

  const items = ((itemsResult.data ?? []) as ItemRow[]).map((row) => ({
    ...toItem(row),
    images: imagesByItem.get(row.id) ?? [],
  }))

  // One signing call for every cover rather than one per item — the round trips
  // are what cost, not the number of paths.
  const coverPaths = items
    .map((item) => item.images.find((image) => image.sortOrder === 0)?.thumbPath)
    .filter((path): path is string => Boolean(path))

  const signed = await signPaths(coverPaths)

  return items.map((item) => {
    const cover = item.images.find((image) => image.sortOrder === 0)
    return { ...item, coverUrl: cover ? (signed.get(cover.thumbPath) ?? null) : null }
  })
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
 * The row is inserted first so the photos have an item id to live under. If any
 * upload then fails the row is deleted again — a wardrobe entry with no photo is
 * worse than no entry, because the grid is entirely visual and the user would
 * have no idea what the card refers to.
 */
export async function createItem(
  draft: ItemDraft,
  photos: ProcessedPhoto[],
  userId: string,
): Promise<WardrobeItem> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('items')
    .insert(toItemPayload(draft, userId))
    .select(ITEM_COLUMNS)
    .single()

  if (error) throw error
  const item = toItem(data as ItemRow)

  try {
    const images = await uploadPhotos(item.id, userId, photos)
    const covers = await signPaths(images.length ? [images[0].thumbPath] : [])
    return {
      ...item,
      images,
      coverUrl: images.length ? (covers.get(images[0].thumbPath) ?? null) : null,
    }
  } catch (uploadError) {
    await deleteItem(item.id, userId).catch(() => {
      // Swallow: the upload failure is the one worth reporting, and a failed
      // cleanup would otherwise mask it.
    })
    throw uploadError
  }
}

async function uploadPhotos(
  itemId: string,
  userId: string,
  photos: ProcessedPhoto[],
) {
  const supabase = getSupabase()
  const storage = supabase.storage.from(STORAGE_BUCKET)
  const rows: Record<string, unknown>[] = []

  for (const [index, photo] of photos.entries()) {
    const imageId = crypto.randomUUID()
    const base = `${userId}/${itemId}/${imageId}`
    const path = `${base}.${photo.ext}`
    const thumbPath = `${base}_thumb.${photo.ext}`
    const contentType = contentTypeOf(photo.ext)

    const [full, thumb] = await Promise.all([
      storage.upload(path, photo.full, { contentType }),
      storage.upload(thumbPath, photo.thumb, { contentType }),
    ])
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

  if (rows.length === 0) return []

  const { data, error } = await supabase.from('item_images').insert(rows).select(IMAGE_COLUMNS)
  if (error) throw error
  return ((data ?? []) as ItemImageRow[]).map(toItemImage)
}

export async function updateItem(id: string, draft: ItemDraft, userId: string): Promise<Item> {
  const payload = toItemPayload(draft, userId)
  // user_id is immutable; sending it would be a no-op at best and a rejected
  // RLS check at worst.
  delete payload.user_id

  const { data, error } = await getSupabase()
    .from('items')
    .update(payload)
    .eq('id', id)
    .select(ITEM_COLUMNS)
    .single()

  if (error) throw error
  return toItem(data as ItemRow)
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
 * Storage is emptied first. The database cascade removes the rows the moment the
 * item goes, and without their paths the objects would be unreachable orphans
 * billing against the storage quota forever.
 */
export async function deleteItem(id: string, userId: string): Promise<void> {
  const supabase = getSupabase()

  const { data, error: listError } = await supabase
    .from('item_images')
    .select('path, thumb_path')
    .eq('item_id', id)
  if (listError) throw listError

  const paths = (data ?? []).flatMap((row) => [
    row.path as string,
    row.thumb_path as string,
  ])

  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage.from(STORAGE_BUCKET).remove(paths)
    if (removeError) throw removeError
  }

  const { error } = await supabase.from('items').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}
