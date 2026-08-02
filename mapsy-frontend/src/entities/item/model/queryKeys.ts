/**
 * Cache keys for the wardrobe — the item entity's one collection query.
 *
 * Lives in the entity rather than in a shared registry because a key is the
 * *address* of a cache entry, and an address belongs beside the thing that
 * fills it — `fetchWardrobe` is in this slice. A global registry puts the two
 * an import away from each other and gains nothing: the drift it is supposed to
 * prevent is between the mutations below and this file, which are neighbours
 * either way.
 *
 * Two shapes, and the difference matters:
 *
 * - `all` is a **prefix**. react-query matches `cancelQueries` and
 *   `invalidateQueries` by prefix, so this reaches every wardrobe query
 *   including ones added later.
 * - `list()` is an **exact** key. `setQueryData` and `getQueryData` do not match
 *   by prefix — they address one entry — so those must go through it.
 */

const ROOT = ['wardrobe'] as const

export const wardrobeKeys = {
  all: ROOT,
  /** The whole collection — one entry, filtered client-side (PRD §8.4). */
  list: () => [...ROOT, 'list'] as const,
} as const
