import { Unplug } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { useCreateItem } from '@/entities/item'
import { useCurrentUserId } from '@/features/auth'
import { ItemForm, type ItemFormValues } from '@/features/item-form'
import { newId } from '@/shared/lib/id'
import { buttonStyle } from '@/shared/ui/buttonStyle'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ScreenHeader } from '@/shared/ui/ScreenHeader'

/**
 * 옷 등록 (PRD §6.2).
 *
 * Submitting navigates straight back to the wardrobe: the pending-upload store
 * puts a card on the grid immediately and the upload continues behind it. Only
 * the failure case needs the user's attention again, and the card carries that
 * — including the reason, since a constraint violation fails the same way on
 * every retry.
 */
export function ItemNewPage() {
  const navigate = useNavigate()
  const userId = useCurrentUserId()
  const create = useCreateItem()

  function handleSubmit({ photos, ...draft }: ItemFormValues) {
    if (!userId) return
    create.mutate({
      pending: { tempId: newId(), draft, photos, userId, state: 'uploading' },
    })
    navigate('/', { replace: true })
  }

  return (
    <ScreenHeader title="옷 등록" subtitle="사진과 이름, 카테고리만 있으면 끝나요.">
      {userId ? (
        <ItemForm
          submitLabel="등록"
          onSubmit={handleSubmit}
          onCancel={() => navigate('/')}
        />
      ) : (
        <EmptyState
          icon={<Unplug size={24} />}
          title="등록은 아직 할 수 없어요"
          description="Supabase 환경변수가 없는 미리보기 모드예요. 화면은 둘러볼 수 있어요."
          action={
            <Link to="/" className={buttonStyle({ variant: 'outline' })}>
              내 옷장으로
            </Link>
          }
        />
      )}
    </ScreenHeader>
  )
}
