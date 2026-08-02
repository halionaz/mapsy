/**
 * Cache keys for the wardrobe — the item entity's one collection query.
 *
 * Lives in the entity rather than in a shared registry: `shared` is the one
 * layer that must not know what a garment is, and a key named "wardrobe" down
 * there is the domain leaking to the bottom of the app.
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
