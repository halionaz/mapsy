import { TriangleAlert } from 'lucide-react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'

import { useSession } from '@/features/auth'
import * as styles from './AppLayout.css'

/**
 * 로그인 뒤 모든 화면을 감싸는 껍데기이자, 그것을 그렇게 만드는 게이트.
 *
 * mapsy는 모바일 우선이고, 데스크톱에서는 같은 컬럼을 가운데 두되 다른 레이아웃으로
 * 재배치하지 않는다(PRD §9). MVP에는 탭 바가 없지만 — 목적지가 하나뿐이다 — 껍데기가
 * 있으므로 옷장 / 코디 / 탐색을 나중에 붙이는 것이 한 곳의 변경이 된다.
 */
export function AppLayout() {
  const session = useSession()
  const location = useLocation()

  if (session.status === 'loading') {
    // 스피너가 아니라 일부러 빈 화면이다. 저장된 토큰을 읽는 것은 거의 즉시라,
    // 한 프레임 깜빡이는 스피너는 덜컹거림으로 읽힌다.
    return <div className={styles.shell} />
  }

  if (session.status === 'anonymous') {
    // `from`이 로그인 화면에게 사용자가 열었던 딥링크로 돌려보낼 곳을 알려준다.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <div className={styles.shell}>
      {session.status === 'unconfigured' && <PreviewBanner />}
      <Outlet />
    </div>
  )
}

/**
 * Supabase 자격 증명이 없을 때 보인다. 그 상태에서도 앱은 온전히 둘러볼 수 있어 백엔드보다
 * 먼저 UI를 만들 수 있고, 이 배너가 그것이 동작하는 로그인 상태로 오해되는 것을 막는다.
 */
function PreviewBanner() {
  return (
    <div className={styles.previewBanner}>
      <TriangleAlert size={14} aria-hidden="true" className={styles.previewIcon} />
      <span>Supabase 미설정 — 미리보기 모드</span>
      <Link to="/login" className={styles.previewLink}>
        로그인 화면
      </Link>
    </div>
  )
}
