import { Navigate, useLocation } from 'react-router'

import { useSession, useSignIn } from '@/features/auth'
import { isSupabaseConfigured } from '@/shared/api/supabase'
import { errorMessage } from '@/shared/lib/errorMessage'
import { Button } from '@/shared/ui/Button'
import * as styles from './LoginPage.css'

/**
 * 로그인 — Google 버튼 하나, 가입 폼 없음 (PRD §3).
 *
 * mapsy는 아직 1인용이지만 인증은 Supabase Auth를 거친다. 그래야 모든 행이 RLS 아래에서
 * `auth.uid()`로 좁혀지고, 나중에 다른 사람에게 여는 것이 재작성이 아니라 설정 변경이 된다.
 *
 * 화면이 워드마크와 버튼 하나뿐이라 첫인상 전체가 타입에 실린다.
 */
export function LoginPage() {
  const session = useSession()
  const location = useLocation()
  const signIn = useSignIn()

  // 세션이 도착하는 순간 이 화면을 떠난다 — OAuth 리다이렉트에서 돌아오는 길도 포함이다.
  if (session.status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }

  return (
    <div className={styles.screen}>
      <div className={styles.glow} aria-hidden="true" />

      <div className={styles.center}>
        <div className={styles.wordmarkBlock}>
          <h1 className={styles.wordmark}>mapsy</h1>
          <p className={styles.tagline}>내가 가진 옷을 한눈에</p>
        </div>

        <div className={styles.actions}>
          <Button
            variant="inverted"
            size="lg"
            full
            icon={<GoogleMark />}
            loading={signIn.isPending}
            disabled={!isSupabaseConfigured}
            onClick={() => signIn.mutate()}
          >
            {signIn.isPending ? '이동 중…' : 'Google로 계속하기'}
          </Button>

          {!isSupabaseConfigured && (
            <p className={styles.note}>
              Supabase 환경변수가 아직 없어요.
              <br />
              <code className={styles.code}>.env.example</code>을{' '}
              <code className={styles.code}>.env.local</code>로 복사해 채워주세요.
            </p>
          )}

          {signIn.error && (
            <p role="alert" className={styles.error}>
              {errorMessage(signIn.error, '로그인에 실패했어요.')}
            </p>
          )}
        </div>
      </div>

      <p className={styles.footnote}>계속하면 옷장 데이터가 이 계정에 저장돼요</p>
    </div>
  )
}

/**
 * Google의 마크를 인라인으로 그린다.
 *
 * 그들의 로그인 가이드라인이 버튼에 네 색 G를 요구하고, 앱에서 우리 아닌 브랜드가 색에
 * 발언권을 갖는 유일한 자리다. 에셋이 아니라 인라인이라 요청이 들지 않고 테마에서
 * 아무것도 물려받지 않는다 — 이 네 hex는 Google이 정한 것이지 우리가 정한 것이 아니다.
 */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}
