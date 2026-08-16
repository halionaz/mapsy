import { Check, X } from 'lucide-react'

import { formatMonthDay } from '@/shared/lib/format'
import { Button, IconButton } from '@/shared/ui/Button'
import * as styles from './WearSelectionBar.css'

/**
 * 옷을 고르는 동안의 아래 행 — 옷 등록과 착용 버튼 위에 얹히는 게 아니라 그것들을 대신한다.
 *
 * ```
 * [ 8.15 (오늘) ] [    3벌 기록    ] [ ✕ ]
 * ```
 *
 * 격자 위가 아니라 아래인 것은, 날짜와 취소 둘 다 스크롤하는 엄지가 찾는 것이기 때문이다.
 *
 * 날짜는 **컨트롤이 아니라 라벨**이다. 쓸 수 있는 날이 오늘뿐이라 옮겨갈 곳이 없다.
 * 그래도 말과 함께 실제 날짜를 싣는다 — `오늘`만으로는 자정 전부터 열려 있었을 화면에서
 * 확인할 수 없는 주장이다.
 */
interface WearSelectionBarProps {
  /** 기록되는 날. 늘 오늘이다. */
  wornOn: string
  selectedCount: number
  /** 이 선택이 시작되기 전에 그날이 담고 있던 수. */
  recordedCount: number
  submitting: boolean
  onSubmit: () => void
  onCancel: () => void
}

export function WearSelectionBar({
  wornOn,
  selectedCount,
  recordedCount,
  submitting,
  onSubmit,
  onCancel,
}: WearSelectionBarProps) {
  /**
   * 아무것도 없이 제출하는 것은 두 가지 다른 일이고, 그중 하나만 실수다.
   *
   * 옷이 있던 날을 비우는 것은 진짜 편집이고("결국 그중 아무것도 안 입었다") DB 함수도
   * 빈 집합을 그래서 받는다. 원래 비어 있던 날에 제출을 누르는 것은 아무 일도 아니다.
   */
  const clearing = selectedCount === 0 && recordedCount > 0

  /** 한 번만 써서 인쇄된 날짜와 읽히는 날짜가 어긋나지 않게 한다. */
  const day = `${formatMonthDay(wornOn) ?? wornOn} (오늘)`

  return (
    /* 날짜가 그룹의 이름에 실린다. 실려야 한다 — 아래 문단은 포커스를 받지 않고 role도
       없어서 탭 순서 안에 어느 날인지 말하는 것이 없다. 문단 자체에 `aria-label`을
       붙여도 실리지 않는다. role 없는 요소의 aria-label은 대부분의 스크린리더가 무시한다. */
    <div className={styles.bar} role="group" aria-label={`${day} 입은 옷 고르기`}>
      <p className={styles.dateLabel}>{day}</p>

      {/* `full`이라 나머지 둘이 남긴 폭을 가져가고, 두 자릿수가 오면 먼저 줄어든다. */}
      <Button
        full
        icon={<Check />}
        loading={submitting}
        disabled={selectedCount === 0 && recordedCount === 0}
        onClick={onSubmit}
        className={styles.floating}
      >
        {selectedCount > 0
          ? `${selectedCount}벌 기록`
          : clearing
            ? '기록 지우기'
            : '옷을 골라주세요'}
      </Button>

      {/* 말이 아니라 글리프인 것은 라벨 붙은 알약 셋이 폰 가로폭에 들어가지 않기
          때문이고, 셋 중 맨 ✕가 이미 뜻을 가진 것은 이것뿐이다. 아무것도 안 골랐을 때
          제출이 잠기므로 이것이 모드에서 나가는 유일한 길이다 — 그래서 폭을 내주는
          컨트롤이 결코 되지 않는다. */}
      <IconButton label="고르기 취소" filled onClick={onCancel} className={styles.floating}>
        <X size={18} />
      </IconButton>
    </div>
  )
}
