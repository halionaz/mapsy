import { useNavigate } from 'react-router'

import { useCreateItem } from '@/entities/item'
import { useCurrentUserId } from '@/features/auth'
import { ItemForm, type ItemFormValues } from '@/features/item-form'
import { newId } from '@/shared/lib/id'
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
    <ScreenHeader title="옷 등록">
      {userId ? (
        <ItemForm
          submitLabel="등록"
          onSubmit={handleSubmit}
          onCancel={() => navigate('/')}
        />
      ) : (
        <p>Supabase 미설정 상태라 등록은 할 수 없어요.</p>
      )}
    </ScreenHeader>
  )
}
