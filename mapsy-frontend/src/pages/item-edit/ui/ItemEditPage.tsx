import { SearchX } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'

import { storedPhotoEntries, useUpdateItem, useWardrobe } from '@/entities/item'
import { ItemForm, type ItemFormValues } from '@/features/item-form'
import { useItemPhotos } from '@/features/item-photos'
import { releasePreview } from '@/shared/lib/image'
import { Spinner } from '@/shared/ui/Button'
import { buttonStyle } from '@/shared/ui/Button.css'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ScreenHeader } from '@/shared/ui/ScreenHeader'
import { toaster } from '@/shared/ui/toast'
import * as styles from './ItemEditPage.css'

/**
 * 옷 편집 (PRD §6.3).
 *
 * 등록과 같은 폼을 채워서 쓴다 — 사진까지 포함해서. 추가·삭제·재정렬이 전부 폼 자신의
 * 목록에서 일어나고 저장을 누를 때 쓰이므로, 취소하면 옷이 있던 그대로 남는다. 대가는
 * 업로드를 기다리는 저장이다. 등록은 사진을 백그라운드 스토어에 넘기고 곧장 격자로
 * 돌아가는데, 그럴 수 있는 것은 아직 화면에 그 업로드와 모순될 것이 없기 때문이다.
 */
export function ItemEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useWardrobe()
  const update = useUpdateItem()

  const item = data?.find((entry) => entry.id === id)

  /**
   * 옷이 이미 가진 사진의 썸네일.
   *
   * 상세 화면과 같은 훅을 거친다. 이 화면은 거기서만 닿으므로 그 URL이 이미 캐시에 있고
   * 브라우저가 이미 디코드했다 — 같은 다섯 장에 다른 URL을 요구하면 전부 다시 받는다.
   */
  const { slots } = useItemPhotos(item?.images)
  // pending 슬롯은 아예 뺀다 — 없음이 "오는 중"이고, 피커가 스켈레톤을 그리는 상태다.
  // 인라인으로 짓는다. 아래쪽에서 이것을 identity로 비교하는 것이 없다.
  const storedUrls = new Map(
    slots.flatMap((slot) =>
      // 원본이 아니라 썸네일이다. 84px 타일에 1280px을 넣던 자리이고, 그 훅이 이제 둘 다
      // 서명하므로 더 작은 쪽을 그냥 고를 수 있다.
      //
      // 원본으로 되돌아가는 것은 썸네일만 서명하지 못한 슬롯 때문이다. `ready`는 원본이
      // 있다는 뜻일 뿐 썸네일까지 왔다는 뜻이 아니고(`createSignedUrls`는 경로별 실패를
      // 결과에 실어 보낸다), 그 `null`을 그대로 넘기면 피커가 멀쩡한 사진에
      // "불러오지 못함"을 그린다.
      slot.state === 'pending' ? [] : [[slot.id, slot.thumbUrl ?? slot.url] as const],
    ),
  )

  // 이 화면에 닿을 때쯤이면 옷장이 보통 이미 캐시에 있다(상세 화면에서 열린다).
  // 그래서 스켈레톤을 그리지 않고 알리기만 한다 — 아래 폼이 곧장 채우지 않을, 자리를
  // 잡아둘 것이 여기 없다.
  if (isLoading) {
    return (
      <ScreenHeader title="옷 편집" status="옷 정보를 불러오는 중이에요.">
        <div className={styles.loading}>
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

  function handleSubmit({ photos, photosChanged, ...draft }: ItemFormValues) {
    if (!item) return
    update.mutate(
      { item, draft, photos, photosChanged },
      {
        onSuccess: () => {
          navigate(`/items/${item.id}`, { replace: true })
          toaster.create({ title: '저장했어요.', type: 'success' })

          // 고른 사진이 이제 스토리지에 있으니 미리보기를 놓아준다. 제출 시점이 아니라
          // 여기까지 붙들었던 것은, 실패한 저장이 폼을 세워둔 채 남기고 재시도가 바로 이
          // 바이트에서 다시 올리기 때문이다.
          for (const entry of photos) {
            if (entry.kind === 'picked') releasePreview(entry.photo)
          }
        },
      },
    )
  }

  return (
    // 같은 폼이니 같은 고정 액션 바이고 이유도 같다 — 이미 값이 있는 옷은 선택 구획이
    // 기본으로 열리고, 저장이 마지막 필드에서 가장 먼 것이 정확히 그 경우다.
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
