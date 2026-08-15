/**
 * Cache keys for the wear log — one collection query, like the wardrobe's.
 *
 * A separate entry from `wardrobeKeys` on purpose. Toggling a wear must not
 * disturb the item cache: re-fetching that entry re-signs every cover URL, which
 * changes every `<img src>` and reloads the whole grid. Two entries mean a wear
 * write touches only wear rows.
 *
 * Same two shapes and the same reason as `entities/item/model/queryKeys.ts` —
 * `all` is a prefix for cancel/invalidate, `list()` is the exact key
 * `setQueryData` needs.
 */

const ROOT = ['wears'] as const

export const wearKeys = {
  all: ROOT,
  /** Every wear this user has recorded, aggregated client-side. */
  list: () => [...ROOT, 'list'] as const,
} as const
