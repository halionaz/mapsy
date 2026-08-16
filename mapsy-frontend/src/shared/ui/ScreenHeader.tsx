import { useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

import { useScrolledPast } from '@/shared/lib/useScrolledPast'
import { IconButton } from './Button'
import * as styles from './ScreenHeader.css'

/**
 * 하위 화면의 뼈대 — 뒤로 가기, 화면 이름, 패딩이 붙은 본문.
 *
 * 이름은 본문 맨 위에 크게 한 번 놓이고, 고정 바는 그것이 스크롤로 사라진 뒤에야
 * 이름을 받는다. 등록·상세·편집 화면이 함께 써서 안전영역 패딩이 서로 어긋나지 않는다.
 */
export function ScreenHeader({
  title,
  eyebrow,
  subtitle,
  action,
  hero,
  status,
  flushBottom = false,
  children,
}: {
  title: string
  /** 제목 위 한 줄 — 카테고리, 개수. */
  eyebrow?: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  /** 바와 제목 사이의 전폭 영역. 사진 스트립 같은 것. */
  hero?: React.ReactNode
  /**
   * 이 화면의 상태를 스크린리더에게 알리는 문장.
   *
   * 화면이 아니라 여기 있는 이유는 라이브 리전이 *내용이 바뀔 때* 읽히기 때문이다.
   * 이미 문장을 담은 채 나타난 리전은 읽는 리더와 안 읽는 리더가 갈리고, 데이터가
   * 도착할 때 언마운트되는 리전은 기다림이 끝났다고 말하지 못한다. 화면의 모든 상태가
   * 같은 헤더를 그리므로 이 리전은 상태 전환을 살아남는다.
   */
  status?: string
  /**
   * 본문이 화면 아래 끝까지 닿게 한다.
   *
   * 기본 패딩은 마지막 줄이 홈 인디케이터에 걸리지 않게 하는 것이다. 그 가장자리에
   * 무언가를 직접 고정하는 화면(옷 폼의 액션 바)은 대신 안전영역 인셋을 스스로 떠맡는다.
   */
  flushBottom?: boolean
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const barRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const collapsed = useScrolledPast(titleRef, barRef)

  return (
    <div className={styles.screen}>
      <p role="status" className={styles.srOnly}>
        {status ?? ''}
      </p>

      <header ref={barRef} className={styles.bar} data-collapsed={collapsed || undefined}>
        <IconButton label="뒤로" onClick={() => navigate(-1)}>
          <ChevronLeft size={22} />
        </IconButton>

        {/* 바가 가진 제목의 사본. 진짜 제목은 아래 <h1>이고 늘 접근성 트리에 있으므로
            여기서 한 번 더 읽히면 화면 이름을 두 번 말하게 된다. */}
        <span className={styles.barTitle} aria-hidden="true">
          {title}
        </span>

        <div className={styles.barActionSlot}>{action}</div>
      </header>

      {hero}

      <main className={styles.main({ flushBottom })}>
        <div ref={titleRef} className={styles.titleBlock}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>

        {children}
      </main>
    </div>
  )
}
