/**
 * 옷 엔티티의 공개 API.
 *
 * 이 폴더 밖에서는 `@/entities/item`까지만 import한다. 그래야 `api/`·`model/`·`ui/`를
 * 호출부를 건드리지 않고 재배치할 수 있고, 내부인 것은 내부로 남는다.
 */

export type {
  Item,
  ItemDraft,
  ItemImage,
  ItemStatus,
  ItemWithImages,
  WardrobeItem,
} from './model/types'

export {
  photoEntryKey,
  samePhotoList,
  storedPhotoEntries,
  type PhotoEntry,
} from './model/photoEntries'

export {
  useCreateItem,
  // 화면이 아니라 `features/item-delete`가 쓴다 — 이것만으로는 착용 기록 캐시가 남는다.
  useDeleteItemRow,
  useDiscardUpload,
  useRetryUpload,
  useSetFavorite,
  useSetStatus,
  useUpdateItem,
  useWardrobe,
} from './model/queries'

export { usePendingUploads, type PendingUpload } from './model/pendingUploads'

export { CardSkeleton, ItemCard, PendingCard, SelectableItemCard } from './ui/ItemCard'
