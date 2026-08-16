import { useSession } from './queries'

/**
 * 로그인한 사용자의 id. 미리보기 모드에서는 null.
 *
 * 모든 쓰기가 이것을 필요로 하고(행이 `user_id`를 싣고 스토리지 경로가 그것으로 시작한다),
 * AppLayout 뒤의 화면은 Supabase가 설정돼 있으면 이것이 있다고 믿어도 된다 — 게이트가
 * 이미 지나갔다.
 */
export function useCurrentUserId(): string | null {
  const session = useSession()
  return session.status === 'authenticated' ? session.session.user.id : null
}
