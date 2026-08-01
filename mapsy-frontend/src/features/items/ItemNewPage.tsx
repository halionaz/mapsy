import { useNavigate } from 'react-router'

import { useCurrentUserId } from '@/features/auth/useCurrentUserId'
import { ItemForm, type ItemFormValues } from './ItemForm'
import { ScreenHeader } from './ScreenHeader'
import { useCreateItem } from './queries'

/**
 * 옷 등록 (PRD §6.2).
 *
 * Submitting navigates straight back to the wardrobe: the card is already on the
 * grid from the optimistic cache entry, and the upload continues behind it. Only
 * the failure case needs the user's attention again, and the card carries that.
 */
export function ItemNewPage() {
  const navigate = useNavigate()
  const userId = useCurrentUserId()
  const create = useCreateItem()

  function handleSubmit({ photos, ...draft }: ItemFormValues) {
    if (!userId) return
    create.mutate({ tempId: crypto.randomUUID(), pending: { draft, photos, userId } })
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
