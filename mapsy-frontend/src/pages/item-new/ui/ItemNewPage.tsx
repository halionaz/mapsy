import { Unplug } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { useCreateItem } from '@/entities/item'
import { useCurrentUserId } from '@/features/auth'
import { ItemForm, type ItemFormValues } from '@/features/item-form'
import { newId } from '@/shared/lib/id'
import { buttonStyle } from '@/shared/ui/Button.css'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ScreenHeader } from '@/shared/ui/ScreenHeader'

/**
 * 옷 등록 (PRD §6.2).
 *
 * 제출하면 곧장 옷장으로 돌아간다. 등록 대기 스토어가 격자에 카드를 즉시 올리고 업로드는
 * 그 뒤에서 이어진다. 사용자의 주의를 다시 필요로 하는 것은 실패뿐이고, 그것은 카드가
 * 이유까지 함께 싣는다.
 */
export function ItemNewPage() {
  const navigate = useNavigate()
  const userId = useCurrentUserId()
  const create = useCreateItem()

  // `photosChanged`는 편집 화면의 질문이다 — 여기엔 사진이 달라졌을 대상이 없다.
  function handleSubmit({ photos, photosChanged: _changed, ...draft }: ItemFormValues) {
    if (!userId) return
    create.mutate({
      pending: {
        tempId: newId(),
        draft,
        // 여기서는 전부 고른 사진이다 — 저장본이 속했을 옷이 아직 없다.
        photos: photos.flatMap((entry) => (entry.kind === 'picked' ? [entry.photo] : [])),
        userId,
        state: 'uploading',
      },
    })
    navigate('/', { replace: true })
  }

  return (
    <ScreenHeader
      title="옷 등록"
      subtitle="사진과 이름, 카테고리만 있으면 끝나요."
      // 폼이 그려질 때만. 아래 가장자리에 고정되며 안전영역 인셋을 떠맡는 것은 폼의
      // 액션 바다. 아래 미리보기 모드 안내는 평범한 스크롤 콘텐츠라 본문 패딩이 필요하다.
      flushBottom={userId != null}
    >
      {userId ? (
        <ItemForm submitLabel="등록" onSubmit={handleSubmit} onCancel={() => navigate('/')} />
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
