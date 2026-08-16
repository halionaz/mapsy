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
  ItemWithImages,
  WardrobeItem,
} from './model/types'

export { photoEntryKey, storedPhotoEntries, type PhotoEntry } from './model/photoEntries'

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

export { CardSkeleton, ItemCard, PendingCard, SelectableItemCard } from './ui/ItemCard'
