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
 * Whether two photo lists say the same thing — same photos, same order.
 *
 * The save asks this of the list the form was opened with against the list it is
 * handing back, and the comparison has to be against **that** rather than
 * against whatever the wardrobe cache holds now. `set_item_images` writes
 * exactly the list it is given, so anything it is not told about is deleted; the
 * question worth asking is therefore "did the person touch the photos", and only
 * the form knows.
 *
 * Comparing against the cache instead looked equivalent and was not. The cache
 * refetches on window focus, so a screen left open while another device added a
 * sixth photo comes back with six in the cache and five in the form — and a save
 * that was only ever about the memo field then reads as a change and deletes the
 * photo the user never saw.
 *
 * What this cannot answer is the same edit when the photos *were* touched: the
 * list is a whole answer, so the sixth photo goes. Refusing that needs the
 * server to compare versions, which is a different piece of work.
 */
export function samePhotoList(
  a: readonly PhotoEntry[],
  b: readonly PhotoEntry[],
): boolean {
  return (
    a.length === b.length &&
    a.every((entry, index) => photoEntryKey(entry) === photoEntryKey(b[index]))
  )
}
