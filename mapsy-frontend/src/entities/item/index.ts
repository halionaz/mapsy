/**
 * Public API of the item entity.
 *
 * Everything outside this folder imports from `@/entities/item` and nothing
 * deeper — so `api/`, `model/` and `ui/` can be rearranged without touching a
 * call site, and what is internal stays internal (`fetchWardrobe`, `mapRow`,
 * `coverOf`: reachable only through the hooks below).
 */

export type {
  Item,
  ItemDraft,
  ItemImage,
  ItemStatus,
  WardrobeItem,
} from './model/types'

export {
  useCreateItem,
  useDeleteItem,
  useDiscardUpload,
  useRetryUpload,
  useSetFavorite,
  useSetStatus,
  useUpdateItem,
  useWardrobe,
} from './model/queries'

export { usePendingUploads, type PendingUpload } from './model/pendingUploads'

/**
 * Photo editing, with no screen calling it yet — the database functions and
 * `pnpm test:db` cover both, and the edit screen is where they will be used.
 * Exported so the pair stays part of the entity's surface rather than looking
 * like dead code inside it.
 */
export { deleteItemImage, reorderItemImages } from './api/itemApi'

export { CardSkeleton, ItemCard, PendingCard } from './ui/ItemCard'
