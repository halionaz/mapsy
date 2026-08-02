/**
 * Every react-query key in the app.
 *
 * Keys are collected here rather than declared beside the hook that fetches
 * with them because they are read from *both* sides: the hook that owns the
 * query, and every mutation that patches, cancels or invalidates it. A key
 * spelled out at the second kind of call site is a silent no-op when it drifts
 * — `setQueryData` on a key nothing observes writes to a cache entry that is
 * never read, and reports no error.
 *
 * Two shapes, and the difference matters:
 *
 * - `all` is a **prefix**. react-query matches `cancelQueries` and
 *   `invalidateQueries` by prefix, so this reaches every query in the group
 *   including ones added later.
 * - the functions build **exact** keys. `setQueryData` and `getQueryData` do not
 *   match by prefix — they address one entry — so those must go through these.
 */

const WARDROBE_ROOT = ['wardrobe'] as const
const STORAGE_ROOT = ['storage'] as const

export const queryKeys = {
  wardrobe: {
    all: WARDROBE_ROOT,
    /** The whole collection — one entry, filtered client-side (PRD §8.4). */
    list: () => [...WARDROBE_ROOT, 'list'] as const,
  },

  storage: {
    all: STORAGE_ROOT,
    /**
     * Signed URLs for a set of object paths.
     *
     * The paths are part of the key, so a different set is a different entry and
     * URLs can never be read against the wrong photos. Order is significant:
     * callers match the result to their photos by position.
     */
    signedUrls: (paths: readonly string[]) => [...STORAGE_ROOT, 'signed-urls', paths] as const,
  },
} as const
