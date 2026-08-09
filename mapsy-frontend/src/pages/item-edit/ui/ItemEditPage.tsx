import { SearchX } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'
import { css } from 'styled-system/css'

import { useUpdateItem, useWardrobe } from '@/entities/item'
import { useCurrentUserId } from '@/features/auth'
import { ItemForm, type ItemFormValues } from '@/features/item-form'
import { Spinner } from '@/shared/ui/Button'
import { buttonStyle } from '@/shared/ui/buttonStyle'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ScreenHeader } from '@/shared/ui/ScreenHeader'
import { toaster } from '@/shared/ui/toast'

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

  function handleSubmit({ photos: _photos, ...draft }: ItemFormValues) {
    if (!userId || !item) return
    update.mutate(
      { id: item.id, draft },
      {
        onSuccess: () => {
          navigate(`/items/${item.id}`, { replace: true })
          toaster.create({ title: '저장했어요.', type: 'success' })
        },
      },
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
