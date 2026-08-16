import { CalendarCheck } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import * as styles from './WearFab.css'

/**
 * 착용 기록으로 들어가는 문. 옷장 오른쪽 아래에 있다.
 *
 * ```
 * 기록 없음   [ ✓ 기록하기 ]   ← 스크롤하면 아이콘만 남음
 * 기록 있음   [ ✓ 오늘 3벌 ]
 * ```
 *
 * 두 상태뿐인 것은 눌리는 순간 아래 행 전체가 `WearSelectionBar`로 바뀌기 때문이다.
 *
 * 옆의 옷 등록과 같은 크기다. 위계는 높이가 아니라 채움색이 진다 — 한 줄에 높이가 다른
 * 알약 둘은 하나가 끼워 넣어진 것처럼 읽힌다. 둘이 따로 고정되어 폰에서는 컬럼 하나의
 * 폭을 나눠 쓰고, 아래의 접힘이 그것을 돌려준다.
 */
interface WearFabProps {
  /** 오늘이 이미 담고 있는 옷의 수. */
  recordedCount: number
  /** 격자가 한 번이라도 스크롤됐는지. */
  collapsed: boolean
  onOpen: () => void
}

export function WearFab({ recordedCount, collapsed, onOpen }: WearFabProps) {
  // 오늘을 prop이 아니라 적어 넣은 것은, 이 버튼이 여는 날이 오늘뿐이기 때문이다.
  // 값이 하나뿐인 `dayLabel` prop은 선택처럼 읽힌다. 선택은 날짜 피커와 함께 온다.
  const recorded = recordedCount > 0
  const label = recorded ? `오늘 ${recordedCount}벌` : '기록하기'

  return (
    <Button
      variant="surface"
      icon={<CalendarCheck />}
      // 라벨이 접힌 동안에도 이름이 있어야, 읽어주는 쪽에 이름 없는 글리프가 되지 않는다.
      aria-label={recorded ? `${label} 기록 고치기` : '오늘 입은 옷 기록하기'}
      onClick={onOpen}
      className={styles.floating}
    >
      {/* 접히는 것은 초대말뿐이다. `오늘 3벌`은 돌아와서 확인하려던 바로 그 값이고
          충분히 짧다. `기록하기`는 격자가 움직이기 시작할 때쯤 할 말을 다 했다. */}
      <span className={styles.collapsible} data-collapsed={(!recorded && collapsed) || undefined}>
        {label}
      </span>
    </Button>
  )
}
