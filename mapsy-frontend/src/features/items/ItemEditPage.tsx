import { useNavigate, useParams } from 'react-router'

import { useCurrentUserId } from '@/features/auth/useCurrentUserId'
import { ItemForm, type ItemFormValues } from './ItemForm'
import { ScreenHeader } from './ScreenHeader'
import { useUpdateItem, useWardrobe } from './queries'

/**
 * 옷 편집 (PRD §6.3).
 *
 * The same form as registration, prefilled. Photos are not editable here yet —
 * changing them means reconciling uploads, deletions and sort_order against
 * what is already in storage, which is its own piece of work rather than a
 * variation on this one.
 */
export function ItemEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const userId = useCurrentUserId()
  const { data, isLoading } = useWardrobe()
  const update = useUpdateItem()

  const item = data?.find((entry) => entry.id === id)

  // The wardrobe is normally already in cache by the time anyone reaches this
  // screen — it is opened from the detail view — so these are announced rather
  // than drawn as a skeleton: there is nothing here to reserve space for that
  // the form below will not immediately fill.
  if (isLoading) {
    return (
      <ScreenHeader title="옷 편집" status="옷 정보를 불러오는 중이에요.">
        불러오는 중…
      </ScreenHeader>
    )
  }
  if (!item) {
    return (
      <ScreenHeader title="옷 편집" status="이 옷을 찾을 수 없어요.">
        이 옷을 찾을 수 없어요.
      </ScreenHeader>
    )
  }

  function handleSubmit({ photos: _photos, ...draft }: ItemFormValues) {
    if (!userId || !item) return
    update.mutate(
      { id: item.id, draft },
      { onSuccess: () => navigate(`/items/${item.id}`, { replace: true }) },
    )
  }

  return (
    <ScreenHeader title="옷 편집" status={`${item.title} 편집`}>
      <ItemForm
        initial={item}
        showPhotos={false}
        submitLabel="저장"
        pending={update.isPending}
        error={update.error ? '저장하지 못했어요. 잠시 후 다시 시도해주세요.' : null}
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
      />
    </ScreenHeader>
  )
}
