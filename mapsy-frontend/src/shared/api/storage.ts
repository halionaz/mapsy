import { errorMessage } from '@/shared/lib/errorMessage'
import { getSupabase, isSupabaseConfigured, STORAGE_BUCKET } from './supabase'

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

/**
 * The failure inside a settled supabase-js call, or `null` if there was none.
 *
 * **supabase-js hands back `{ error }` far more often than it rejects**, and
 * that includes the case that reads like a crash: with the network gone, an
 * upload or a removal *resolves*, carrying a `StorageUnknownError`. Measured
 * against 2.111.0 — a request to an unreachable host resolves with
 * `__isStorageError = true` and no `status`. Only something that is not a
 * StorageError at all escapes as a rejection.
 *
 * Both shapes are answered here, and callers compare against `null` rather than
 * for truthiness: a rejection carrying `''` or `0` is still a failure, and the
 * callers of this are the ones deciding whether an object was left behind.
 */
export function settledError(result: PromiseSettledResult<{ error: unknown }>): unknown {
  if (result.status === 'rejected') return result.reason ?? new Error('알 수 없는 이유')
  return result.value.error ?? null
}

/**
 * Did the API answer, or did the request never get there?
 *
 * `StorageApiError` carries the HTTP status it was built from; the
 * `StorageUnknownError` a dead connection produces has none. Measured against
 * 2.111.0: a 400 gives `status === 400`, an unreachable host gives `undefined`.
 */
function isApiFailure(failure: unknown): boolean {
  return typeof (failure as { status?: unknown } | null)?.status === 'number'
}

/**
 * Best-effort storage cleanup; **never throws**, and never masks the error that
 * triggered it.
 *
 * Not throwing is the whole contract, and it is load-bearing at all three call
 * sites. Two of them are `catch` blocks that clean up and then re-throw the real
 * failure — a throw here would replace the reason with a janitorial one. The
 * third is the last line of `deleteItem`, where the row is already gone: a throw
 * there is reported to the user as "삭제하지 못했어요" for a garment that really
 * was deleted, which is the mismatch between the database and what the screen
 * says that `deleteItem`'s row check exists to prevent, reopened backwards.
 *
 * Every call therefore goes through `allSettled` — see `settledError` for which
 * shape arrives when. The configuration check belongs to the same promise:
 * `getSupabase()` throws without environment variables and is the only line in
 * here that can, so the guard is what makes "never throws" true rather than
 * merely unreachable. There is nothing in a bucket that does not exist anyway.
 */
export async function removeObjects(paths: readonly string[]): Promise<void> {
  if (paths.length === 0 || !isSupabaseConfigured) return
  const storage = getSupabase().storage.from(STORAGE_BUCKET)

  const [batch] = await Promise.allSettled([storage.remove([...paths])])
  const batchFailure = settledError(batch)
  if (batchFailure === null) return

  /**
   * Only when the API actually answered.
   *
   * The retry below exists for one shape: a batch refused wholesale over one bad
   * key, taking the good keys with it. That is an answer, and it arrives
   * carrying an HTTP status. A request that never landed carries none — and
   * retrying it once per path buys nothing, because every retry dies of the same
   * missing network. `deleteItem` awaits this on its last line with "삭제 중…"
   * on screen, for a row that is already gone.
   */
  if (!isApiFailure(batchFailure)) {
    console.warn('스토리지 정리 실패, 고아 객체가 남았을 수 있음:', errorMessage(batchFailure))
    return
  }

  /**
   * One key must not cost the others.
   *
   * Callers list paths optimistically — an upload that failed may or may not
   * have left its object behind, so this is deliberately asked to remove keys
   * that might not exist. Bulk removal is expected to skip what it cannot find
   * rather than refuse the batch, and if that is ever wrong then a batch refused
   * over a phantom key takes the objects that *do* exist down with it: the exact
   * orphan the caller was trying to avoid.
   */
  const results = await Promise.allSettled(paths.map((path) => storage.remove([path])))
  // Reported from the retries rather than from the batch. When the batch was
  // refused *because* of a phantom key, the batch's own message says nothing
  // about the objects that are actually still there — and the retries that
  // succeeded are not worth mentioning at all.
  const left = results
    .map((result, index) => ({ path: paths[index], failure: settledError(result) }))
    .filter((entry) => entry.failure !== null)

  if (left.length > 0) {
    console.warn(
      `스토리지 정리 실패, 고아 객체 ${left.length}건이 남았을 수 있음:`,
      // Through `errorMessage`, not `String()`: Supabase sometimes answers with a
      // plain object rather than an Error, and `String()` renders that as
      // "[object Object]" — see the header of errorMessage.ts, which is where
      // this repository already met that.
      left.map((entry) => `${entry.path}: ${errorMessage(entry.failure)}`).join(', '),
    )
  }
}
