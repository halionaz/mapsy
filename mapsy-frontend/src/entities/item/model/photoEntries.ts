import type { ProcessedPhoto } from '@/shared/lib/image'
import type { ItemImage } from './types'

/**
 * A photo in the form — one the item already has, or one picked in this session.
 *
 * The edit screen mixes the two in a single ordered list: adding, removing and
 * reordering all happen against the same row of tiles, and which of them is a
 * storage object and which is still a blob in memory only matters at save time.
 *
 * A union rather than an object with an optional blob, for the reason `PhotoSlot`
 * is one: "already stored" and "has an id" are then the same fact to the type
 * checker, and nothing can reach for an id that does not exist yet.
 */
export type PhotoEntry =
  | { kind: 'stored'; image: ItemImage }
  | { kind: 'picked'; photo: ProcessedPhoto }

/** An item's photos as form entries, cover first. */
export function storedPhotoEntries(images: readonly ItemImage[]): PhotoEntry[] {
  return [...images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image) => ({ kind: 'stored', image }))
}

/**
 * React key, and the identity the picker reorders by.
 *
 * A picked photo has no id until it is uploaded, so its preview URL stands in:
 * `URL.createObjectURL` hands out a distinct one per blob, and it lives exactly
 * as long as the entry does.
 */
export function photoEntryKey(entry: PhotoEntry): string {
  return entry.kind === 'stored' ? entry.image.id : entry.photo.previewUrl
}

/**
 * Whether `entries` say anything the item does not already hold.
 *
 * Asked before the save touches photos at all, and not as an optimisation.
 * `set_item_images` writes exactly the list it is given, so a screen opened
 * before another device added a photo would delete that photo on a save that was
 * only ever about the memo field. Skipping the call when the photos are
 * untouched keeps a text edit to the text.
 */
export function hasPhotoChanges(
  images: readonly ItemImage[],
  entries: readonly PhotoEntry[],
): boolean {
  if (entries.length !== images.length) return true

  const inOrder = [...images].sort((a, b) => a.sortOrder - b.sortOrder)
  return entries.some(
    (entry, index) => entry.kind !== 'stored' || entry.image.id !== inOrder[index].id,
  )
}
