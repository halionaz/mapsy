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
export async function removeObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await getSupabase().storage.from(STORAGE_BUCKET).remove(paths)
  if (error) console.warn('스토리지 정리 실패, 고아 객체가 남았을 수 있음:', error.message)
}
