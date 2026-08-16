import {
  CardSkeleton,
  ItemCard,
  PendingCard,
  SelectableItemCard,
  type PendingUpload,
  type WardrobeItem,
} from '@/entities/item'
import type { Worn } from '@/entities/wear'
import { formatDayAgo } from '@/shared/lib/format'
import * as styles from './WardrobeGrid.css'
import type { WardrobeSection } from '../lib/sections'

/**
 * 카드, 그리고 카드만.
 *
 * 선택 모드가 생기면서 `WardrobePage`에서 떼어냈다. 화면에는 격자가 하나인데 그 위의 탭이
 * 뜻할 수 있는 것이 둘이 되었고, 그 분기를 여기 두면 페이지는 자기 다섯 view 중 *어느
 * 것*을 보일지에만 남는다.
 *
 * 그래서 `grid`도 여기 산다. 등록 중인 행·구획·스켈레톤이 같은 세 열을 쓰고, 그 셋이
 * 페이지에서 이것을 마지막으로 찾던 것들이었다.
 */
interface WardrobeGridProps {
  /** 이미 걸러지고 나뉜 것 — `lib/sections` 참고. */
  sections: WardrobeSection<Worn<WardrobeItem>>[]
  pending: PendingUpload[]
  onRetry: (tempId: string) => void
  onDiscard: (tempId: string) => void
  /** 카테고리 제목을 그릴지. 이름 붙일 구획이 하나뿐이면 false. */
  sectioned: boolean
  /** 카드의 "마지막으로 입은 때" 줄을 위한 오늘. */
  today: string
  /** 지금까지 고른 id들. 선택이 진행 중이 아니면 null. */
  selectedIds: Set<string> | null
  onToggleItem: (itemId: string) => void
}

export function WardrobeGrid({
  sections,
  pending,
  onRetry,
  onDiscard,
  sectioned,
  today,
  selectedIds,
  onToggleItem,
}: WardrobeGridProps) {
  return (
    <>
      {/* 맨 위에 고정되고, 필터와 구획 양쪽 바깥에 있다. 업로드를 카테고리 아래에 넣으면
          묻힌다 — 실패한 것은 재시도를 찾을 수 있는 자리에 있어야 하고, 사진이 아직
          올라가는 중에 제목 뒤로 감추는 것은 데이터 손실로 읽힌다.

          고를 수도 없다. 진행 중인 등록에는 행이 없고, 따라서 착용을 기록할 id도 없다. */}
      {pending.length > 0 && (
        <ul className={styles.grid}>
          {pending.map((entry) => (
            <li key={entry.tempId}>
              <PendingCard pending={entry} onRetry={onRetry} onDiscard={onDiscard} />
            </li>
          ))}
        </ul>
      )}

      {sections.length > 0 && (
        <div className={styles.sections}>
          {sections.map((section) => (
            <section key={section.group.id} className={styles.section}>
              {sectioned && (
                <h2 className={styles.sectionHeading}>
                  {section.group.label}
                  <span className={styles.sectionCount}>{section.items.length}</span>
                </h2>
              )}
              <ul className={styles.grid}>
                {section.items.map((item) => {
                  const wornLabel = item.lastWornOn ? formatDayAgo(item.lastWornOn, today) : null
                  return (
                    <li key={item.id}>
                      {selectedIds ? (
                        <SelectableItemCard
                          item={item}
                          wornLabel={wornLabel}
                          selected={selectedIds.has(item.id)}
                          onToggle={() => onToggleItem(item.id)}
                        />
                      ) : (
                        <ItemCard item={item} wornLabel={wornLabel} />
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

/**
 * 아직 아무것도 없는 같은 세 열, 첫 로드용.
 *
 * 페이지가 아니라 여기 있어서 진짜 격자와 `grid`를 공유한다 — 그 공유가 스켈레톤의
 * 존재 이유이고, 옆에 트랙 정의를 복사해 두면 언젠가 맞지 않게 된다.
 */
export function GridSkeleton() {
  return (
    // 자리표시자는 장식이다 — 빈 리스트 항목 여섯 개는 스크린리더가 걸어야 할 것이 아니다.
    <ul className={styles.grid} aria-hidden="true">
      {SKELETON_KEYS.map((key) => (
        <li key={key}>
          <CardSkeleton />
        </li>
      ))}
    </ul>
  )
}

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e', 'f']
