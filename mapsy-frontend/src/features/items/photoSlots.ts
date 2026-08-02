/**
 * Pairs an item's photos with their signed URLs.
 *
 * This is a three-line rule that has been got wrong twice, in both directions:
 * once by treating "no URLs yet" as "the URLs came back empty" (every tile
 * claimed the photo had failed, for the whole length of a network round trip on
 * the normal cold-load path), and once by matching a previous answer's URLs
 * against a new set of photos by position (tiles showing their neighbour's
 * photo). Neither is visible from reading the call site, and neither needs a DOM
 * to demonstrate — so the rule lives here, where the tests beside it can hold
 * both cases down.
 *
 * The two failure sources are deliberately collapsed into one state. A photo
 * whose URL could not be signed and a photo whose URL was signed but would not
 * load are different events with the same consequence: there is nothing to show
 * and nothing to open, and a screen that distinguishes them is asking the user
 * to care about which half of the pipeline broke.
 */

type PhotoSlotState =
  /** No answer yet — show a skeleton, not a failure. */
  | 'pending'
  /** There is a URL and it works. Only these can be opened in the viewer. */
  | 'ready'
  /** Signing failed, or the photo itself would not load. */
  | 'failed'

/**
 * A union rather than an optional field, so that "ready" and "has a URL" are the
 * same fact to the type checker as well as to the reader — a consumer cannot
 * reach for a URL without first establishing that there is one.
 */
export type PhotoSlot =
  | { id: string; state: 'ready'; url: string }
  | { id: string; state: Exclude<PhotoSlotState, 'ready'>; url: null }

export function photoSlots(
  photos: readonly { id: string }[],
  /** `null` until signing settles; otherwise one entry per photo, in order. */
  urls: readonly (string | null)[] | null,
  /** Ids whose URL was signed but whose photo would not load. */
  unloadable: ReadonlySet<string> = new Set(),
): PhotoSlot[] {
  // A length mismatch means the URLs describe a different set of photos — an
  // answer still in flight, or the previous one still in state. Either way the
  // positions cannot be trusted, and reading them anyway is what put a
  // neighbour's photo in the tile.
  const settled = urls != null && urls.length === photos.length

  return photos.map((photo, index) => {
    if (!settled) return { id: photo.id, url: null, state: 'pending' }

    const url = urls[index] ?? null
    if (url == null || unloadable.has(photo.id)) {
      return { id: photo.id, url: null, state: 'failed' }
    }
    return { id: photo.id, url, state: 'ready' }
  })
}
