import { useMemo } from 'react'
import { SearchX } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { css } from 'styled-system/css'

import { storedPhotoEntries, useUpdateItem, useWardrobe } from '@/entities/item'
import { ItemForm, type ItemFormValues } from '@/features/item-form'
import { useItemPhotos } from '@/features/item-photos'
import { releasePreview } from '@/shared/lib/image'
import { Spinner } from '@/shared/ui/Button'
import { buttonStyle } from '@/shared/ui/buttonStyle'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ScreenHeader } from '@/shared/ui/ScreenHeader'
import { toaster } from '@/shared/ui/toast'

/**
 * 옷 편집 (PRD §6.3).
 *
 * The same form as registration, prefilled — photos included. Adding, removing
 * and reordering all happen in the form's own list and are written when 저장 is
 * pressed, so 취소 leaves the garment exactly as it was. What that costs is a
 * save that waits on the upload: registration hands its photos to a background
 * store and returns to the grid immediately, which it can because there is
 * nothing on screen yet that the upload could contradict.
 */
export function ItemEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useWardrobe()
  const update = useUpdateItem()

  const item = data?.find((entry) => entry.id === id)

  /**
   * Thumbnails for the photos the item already has.
   *
   * Through the detail screen's hook rather than a second signing of the smaller
   * thumbnail paths. This screen is only reachable from that one, so its URLs
   * are already in the cache and already decoded by the browser — asking for
   * different URLs for the same five photos would download them all again. The
   * trade is a deep link straight to /edit, which then pulls full-size originals
   * into 84px tiles.
   */
  const { slots } = useItemPhotos(item?.images)
  const storedUrls = useMemo(
    () =>
      new Map(
        // A pending slot is left out entirely: absent means "still coming",
        // which is what the picker draws a skeleton for.
        slots.flatMap((slot) => (slot.state === 'pending' ? [] : [[slot.id, slot.url] as const])),
      ),
    [slots],
  )

  // The wardrobe is normally already in cache by the time anyone reaches this
  // screen — it is opened from the detail view — so these are announced rather
  // than drawn as a skeleton: there is nothing here to reserve space for that
  // the form below will not immediately fill.
  if (isLoading) {
    return (
      <ScreenHeader title="옷 편집" status="옷 정보를 불러오는 중이에요.">
        <div className={css({ display: 'grid', placeItems: 'center', py: '16' })}>
          <Spinner size={22} />
        </div>
      </ScreenHeader>
    )
  }
  if (!item) {
    return (
      <ScreenHeader title="옷 편집" status="이 옷을 찾을 수 없어요.">
        <EmptyState
          icon={<SearchX size={24} />}
          title="이 옷을 찾을 수 없어요"
          description="삭제됐거나 주소가 잘못됐을 수 있어요."
          action={
            <Link to="/" className={buttonStyle({ variant: 'outline' })}>
              내 옷장으로
            </Link>
          }
        />
      </ScreenHeader>
    )
  }

  function handleSubmit({ photos, ...draft }: ItemFormValues) {
    if (!item) return
    update.mutate(
      { item, draft, photos },
      {
        onSuccess: () => {
          navigate(`/items/${item.id}`, { replace: true })
          toaster.create({ title: '저장했어요.', type: 'success' })

          // The picked photos are in storage now, so their previews can go. Held
          // until here rather than released at submit: a save that fails leaves
          // the form standing, and retrying it re-uploads from these same bytes.
          for (const entry of photos) {
            if (entry.kind === 'picked') releasePreview(entry.photo)
          }
        },
      },
    )
  }

  return (
    // Same form, so the same pinned action bar — and the same reason for it: the
    // optional section opens by default when an item already has values in it,
    // which is exactly the case where 저장 is furthest from the last field.
    <ScreenHeader title="옷 편집" status={`${item.title} 편집`} flushBottom>
      <ItemForm
        initial={{ ...item, photos: storedPhotoEntries(item.images) }}
        storedUrls={storedUrls}
        submitLabel="저장"
        pending={update.isPending}
        error={update.error ? '저장하지 못했어요. 잠시 후 다시 시도해주세요.' : null}
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
      />
    </ScreenHeader>
  )
}
