import { Check, Star } from 'lucide-react'
import { Link } from 'react-router'

import { Button, Spinner } from '@/shared/ui/Button'
import { ColorSwatch } from '@/shared/ui/ColorSwatch'
import { SquarePhoto } from '@/shared/ui/SquarePhoto'
import * as styles from './ItemCard.css'
import type { WardrobeItem } from '../model/types'
import type { PendingUpload } from '../model/pendingUploads'

/**
 * 옷장 격자의 카드.
 *
 * 알아보게 하는 것은 사진이라 카드는 대부분 이미지다. 타일에 카드 표면이 없는 것도 같은
 * 이유 — 테두리 상자 세 열은 사진을 밀어내고 옷보다 장식을 시끄럽게 만든다.
 *
 * 채워진 정보와 무관하게 모든 카드가 같은 상자를 차지한다. 보장된 것이 제목과 사진뿐이라,
 * 선택 정보를 그리는 부분은 접히지 않고 자리를 잡아둔다.
 */

/**
 * 카드 안쪽 전부. 링크 판본과 체크박스 판본이 서로 다른 카드로 갈라지지 않도록.
 *
 * `selected`가 세 값인 것은 의도다. `undefined`는 "선택 모드가 아님"이라 체크를 아예
 * 그리지 않고, `false`는 빈 체크를 그린다. 선택되지 않은 카드와 선택이 일어나지 않는
 * 화면의 카드는 다른 상태이고, boolean은 그 둘을 같게 만든다.
 */
function CardFace({
  item,
  wornLabel,
  selected,
}: {
  item: WardrobeItem
  wornLabel: string | null
  selected?: boolean
}) {
  return (
    <>
      {/* alt이 빈 것은 의도다 — 다음 줄이 제목이고, 두 번 알리는 것은 설명이 아니라 소음이다. */}
      <SquarePhoto
        src={item.coverUrl}
        alt=""
        // `coverUrl`이 null인 이유는 둘이고(사진이 없거나, 있는데 썸네일을 서명하지
        // 못했거나) 쿼리는 둘을 같은 모양으로 건넨다. 그 둘을 가르는 것은 사진 행이다.
        fallback={item.images.length > 0 ? 'failed' : 'empty'}
      >
        {selected && <span className={styles.selectedRing} aria-hidden="true" />}

        {selected !== undefined && (
          <span
            className={styles.checkBadge}
            data-selected={selected || undefined}
            aria-hidden="true"
          >
            {selected && <Check size={12} strokeWidth={3.5} />}
          </span>
        )}

        {item.isFavorite && (
          <span aria-label="즐겨찾기" className={styles.favoriteBadge}>
            <Star size={11} fill="currentColor" strokeWidth={0} />
          </span>
        )}
      </SquarePhoto>

      <span className={styles.title}>{item.title}</span>

      <span className={styles.metaRow}>
        <span className={styles.swatches}>
          {item.colors.map((color) => (
            <ColorSwatch key={color} color={color} />
          ))}
        </span>
        {wornLabel && <span className={styles.wornAgo}>{wornLabel}</span>}
      </span>
    </>
  )
}

interface ItemCardProps {
  item: WardrobeItem
  /**
   * 마지막으로 입은 때, 이미 문장이 된 상태로. 기록이 없으면 `null`.
   *
   * 착용 기록은 다른 엔티티라 카드가 그것을 알지 않는다. 기록이 없는 옷이 "기록 없음"
   * 대신 아무것도 받지 않는 것은, 그 라벨이 기능이 나가고 한동안 모든 카드에 붙고,
   * 모두가 같은 말을 하는 화면은 정보가 아니라 캡션을 받은 것이기 때문이다.
   *
   * optional이 아닌 것은 의도다 — 빠뜨린 호출부가 타입 에러 대신 라벨 없는 카드를 낸다.
   */
  wornLabel: string | null
}

export function ItemCard({ item, wornLabel }: ItemCardProps) {
  return (
    <Link to={`/items/${item.id}`} className={styles.tile}>
      <CardFace item={item} wornLabel={wornLabel} />
    </Link>
  )
}

/**
 * 같은 카드를 체크박스로 — 오늘 입은 옷 고르기용.
 *
 * `<Link>`가 아니라 `<button aria-pressed>`인 것이 두 모드의 차이 전부다. 선택 모드에서
 * 탭은 옷을 여는 대신 기록한다. `tile`을 공유해 크기와 모양이 같으므로, 모드에 들어가도
 * 움직이는 것 없이 탭의 *뜻*만 바뀐다.
 *
 * 여기서 상세 화면으로 가는 길은 일부러 없다. 길게 누르기가 흔한 답이지만 답이 아니다 —
 * 폰에서 그것을 광고하는 것이 없어 만든 사람만 찾을 수 있는 기능이 된다.
 */
export function SelectableItemCard({
  item,
  wornLabel,
  selected,
  onToggle,
}: ItemCardProps & {
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={styles.selectableTile}
    >
      <CardFace item={item} wornLabel={wornLabel} selected={selected} />
    </button>
  )
}

interface PendingCardProps {
  pending: PendingUpload
  onRetry: (tempId: string) => void
  onDiscard: (tempId: string) => void
}

export function PendingCard({ pending, onRetry, onDiscard }: PendingCardProps) {
  const failed = pending.state === 'failed'
  const preview = pending.photos[0]?.previewUrl

  return (
    <div className={styles.stack}>
      {/* 로컬에서 만든 썸네일이 행이 생길 때까지 대신 선다 — 카드가 회색 상자인 적이 없도록. */}
      <SquarePhoto src={preview ?? null} alt="" fallback="empty">
        {!failed && (
          <span className={styles.uploadingScrim}>
            <Spinner size={18} />
          </span>
        )}
      </SquarePhoto>

      <p className={styles.title}>{pending.draft.title}</p>

      {/* 옷 카드와 같은 예약된 줄 — 올라가는 중인 카드가 주변의 저장된 카드와 줄을 맞추도록. */}
      <div className={styles.metaRow}>
        {failed ? (
          <span className={styles.failedText}>업로드 실패</span>
        ) : (
          <span className={styles.uploadingText}>저장 중</span>
        )}
      </div>

      {/* 실패한 카드만 일부러 자란다 — 고쳐달라고 말하는 중이고, 이유와 두 행동에 닿을 수
          있어야 한다. */}
      {failed && (
        <div className={styles.repair}>
          {pending.error && <p className={styles.errorDetail}>{pending.error}</p>}
          <div className={styles.repairActions}>
            <Button size="sm" variant="outline" full onClick={() => onRetry(pending.tempId)}>
              재시도
            </Button>
            <Button size="sm" variant="ghost" full onClick={() => onDiscard(pending.tempId)}>
              버리기
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 아직 아무것도 없는 카드, 옷장 첫 로드용.
 *
 * 진짜 카드와 같은 세 부분이 같은 자리에 있어서, 데이터가 도착해도 격자가 다시 배치되지
 * 않고 자리표시자만 대신하던 것으로 바뀐다.
 */
export function CardSkeleton() {
  return (
    <div className={styles.stack} aria-hidden="true">
      <SquarePhoto src={null} alt="" />
      <div className={styles.skeletonTitleRow}>
        <div className={styles.skeletonTitleBar} />
      </div>
      <div className={styles.metaRow} />
    </div>
  )
}
