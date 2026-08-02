import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { ItemImage } from '@/entities/item'
import { signPaths, SIGNED_URL_TTL_SECONDS, storageKeys } from '@/shared/api/storage'
import { isSupabaseConfigured } from '@/shared/api/supabase'
import { photoSlots, type PhotoSlot } from '../lib/photoSlots'

/**
 * An item's photos, in cover order, paired with signed full-size URLs.
 *
 * Only the thumbnail is signed by the wardrobe query; the originals are signed
 * here so the grid isn't paying for URLs nobody opens.
 *
 * Both jobs live in one hook because they are one invariant: the URLs are
 * matched to the photos **by position**, so deriving the order in one place and
 * the URLs in another is how a tile ends up showing its neighbour's photo. The
 * caller gets slots, which cannot be misaligned.
 */

const NOTHING_UNLOADABLE: ReadonlySet<string> = new Set()

export interface ItemPhotos {
  /** Cover first. The strip, the dots and the viewer all read this order. */
  photos: ItemImage[]
  slots: PhotoSlot[]
  /** A photo whose URL was signed but which the browser would not load. */
  markUnloadable: (photoId: string) => void
}

export function useItemPhotos(images: readonly ItemImage[] | undefined): ItemPhotos {
  const photos = useMemo(
    () => [...(images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [images],
  )
  const paths = useMemo(() => photos.map((photo) => photo.path), [photos])

  const query = useQuery({
    // A fresh array every render is fine: react-query hashes keys by value, so
    // the same paths address the same entry. It is also what removes the old
    // effect-based version's join-the-paths-into-a-string dance — `useEffect`
    // compared them by identity, and every cache patch (starring the item, say)
    // produced a new array, re-signing every URL and remounting every <img>.
    queryKey: storageKeys.signedUrls(paths),
    queryFn: async () => {
      const signed = await signPaths(paths)
      // One entry per photo, in order — `null` for a path that could not be
      // signed. Keeping the slots aligned with the photos is what lets a tile
      // tell "still coming" from "did not arrive".
      return paths.map((path) => signed.get(path) ?? null)
    },
    enabled: isSupabaseConfigured && paths.length > 0,
    // Tied to how long the URLs actually live, not to the 30 minutes the
    // wardrobe list uses. These URLs are what an `<img src>` is built from, and
    // re-signing changes every one of them: the browser caches by full URL
    // including the token, so a refetch re-downloads up to five 1280px
    // originals over the phone's connection. At the default staleTime that
    // happened every half hour, on the first window focus after it — seven
    // times more often than the URLs need it.
    //
    // Half an hour of headroom keeps the recovery the list query was given
    // (`refetchOnWindowFocus` re-signs before anything expires) without paying
    // for it while the URLs are still good.
    //
    // Longer than the global gcTime (an hour) on purpose, and not a
    // contradiction: gcTime only runs once nothing observes the query, so this
    // covers the screen that stays open — a phone backgrounded and picked up
    // again. Leave the screen for an hour and the entry is evicted, which is
    // the right answer too: a cold open should sign afresh. Matching the two
    // numbers in either direction is a regression.
    staleTime: (SIGNED_URL_TTL_SECONDS - 30 * 60) * 1000,
  })

  /**
   * Settled with nothing to show.
   *
   * Without this the tiles would sit on a skeleton for good, which reads as a
   * slow network rather than as a failure the user could retry by reloading.
   * (`retry` is on by default, so this is reached only after the attempts are
   * exhausted.)
   */
  const allFailed = useMemo(() => photos.map(() => null), [photos])
  const urls = query.data ?? (query.isError ? allFailed : null)

  const [unloadable, setUnloadable] = useState<ReadonlySet<string>>(NOTHING_UNLOADABLE)
  const [signedFor, setSignedFor] = useState(query.data)

  // Whatever would not load did so at a URL that no longer exists, so a fresh
  // signing — a different item, or a refetch when the app is foregrounded —
  // deserves another attempt. Adjusted during render rather than in an effect so
  // the stale set is never rendered once first.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (signedFor !== query.data) {
    setSignedFor(query.data)
    setUnloadable(NOTHING_UNLOADABLE)
  }

  // Memoised, and not only to save the work. `PhotoViewer` takes this as a prop
  // and builds its paging callback from it, so a fresh array every render is a
  // fresh callback every render — and the key handler bound to that callback
  // would be detached and reattached on each one. Swiping in the viewer scrolls
  // the strip behind it, which re-renders the screen, so "every render" is every
  // frame of a swipe.
  const slots = useMemo(
    () => photoSlots(photos, urls, unloadable),
    [photos, urls, unloadable],
  )

  return {
    photos,
    slots,
    // Returns the same set when the id is already in it: a new one every time
    // would be a new state value every time, and this is called from an <img>
    // error handler that can fire on a re-render.
    markUnloadable: (photoId) =>
      setUnloadable((failed) => (failed.has(photoId) ? failed : new Set(failed).add(photoId))),
  }
}
