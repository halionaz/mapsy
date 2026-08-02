import { getSupabase, STORAGE_BUCKET } from './supabase'

/**
 * The photo bucket, as far as anything above this layer is concerned.
 *
 * Nothing here knows what an item is — it signs paths and removes objects. Both
 * the wardrobe list (cover thumbnails) and the detail screen (full-size photos)
 * need the same two operations, so they live beside the client rather than in
 * one of the callers.
 */

/**
 * How long a signed URL stays valid. The bucket is private, so every image is
 * signed rather than public.
 *
 * Four hours, paired with `refetchOnWindowFocus` so returning to a backgrounded
 * PWA re-signs them. That covers the phone case; a tab left in the foreground
 * past four hours without ever losing focus still needs a reload, which is the
 * trade for not handing out day-long URLs to a private bucket.
 */
export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 4

/**
 * Cache keys for the queries below — kept beside the fetcher rather than in a
 * shared registry, so a key and the request it addresses move together.
 *
 * The paths are part of the key, so a different set is a different entry and
 * URLs can never be read against the wrong photos. Order is significant:
 * callers match the result to their photos by position. react-query hashes keys
 * by value, so a caller may pass a freshly built array every render.
 */
export const storageKeys = {
  signedUrls: (paths: readonly string[]) => ['storage', 'signed-urls', paths] as const,
} as const

/** Signs a batch of storage paths, returning path → URL for the ones that worked. */
export async function signPaths(paths: readonly string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (paths.length === 0) return result

  const { data, error } = await getSupabase()
    .storage.from(STORAGE_BUCKET)
    .createSignedUrls([...paths], SIGNED_URL_TTL_SECONDS)

  if (error) throw error

  for (const entry of data ?? []) {
    // createSignedUrls reports per-path failures inline instead of throwing, so
    // a single missing object doesn't blank out the whole grid.
    if (entry.signedUrl && entry.path) result.set(entry.path, entry.signedUrl)
  }
  return result
}

/** Best-effort storage cleanup; never masks the error that triggered it. */
export async function removeObjects(paths: readonly string[]): Promise<void> {
  if (paths.length === 0) return
  const storage = getSupabase().storage.from(STORAGE_BUCKET)

  const { error } = await storage.remove([...paths])
  if (!error) return

  /**
   * One key must not cost the others.
   *
   * Callers list paths optimistically — an upload that failed may or may not
   * have left its object behind, so this is deliberately asked to remove keys
   * that might not exist. Bulk removal is expected to skip what it cannot find
   * rather than reject the batch, and if that is ever wrong then a batch failing
   * on a phantom key takes the objects that *do* exist down with it: the exact
   * orphan the caller was trying to avoid. Going one at a time costs a handful
   * of requests on a path that is already recovering from a failure.
   */
  const results = await Promise.allSettled(paths.map((path) => storage.remove([path])))
  const left = results.filter((result) => result.status === 'rejected' || result.value.error)
  if (left.length > 0) {
    console.warn(
      `스토리지 정리 실패, 고아 객체 ${left.length}건이 남았을 수 있음:`,
      error.message,
    )
  }
}
