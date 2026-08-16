import type { Session } from '@supabase/supabase-js'

import { getSupabase } from '@/shared/api/supabase'

/** 저장된 토큰에서 읽은 현재 세션. 없으면 null. */
export async function fetchSession(): Promise<Session | null> {
  const { data, error } = await getSupabase().auth.getSession()
  if (error) throw error
  return data.session
}

/**
 * Google OAuth 왕복을 시작한다 — PRD §3.
 *
 * 세션이 생겼을 때가 아니라 브라우저가 Google로 넘겨졌을 때 resolve한다. 리다이렉트는
 * `redirectTo`로 돌아오고 세션을 집어 드는 것은 `onAuthStateChange`다. 그래서 호출부가
 * 알릴 수 있는 실패는 *떠나지 못한 것*뿐, 로그인 실패가 아니다.
 */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

/**
 * 세션을 끝낸다 — PRD §6.4.
 *
 * 여기서 이동하지 않는다. 세션이 사라지는 것을 `onAuthStateChange`가 보고, `AppLayout`이
 * 게이트로 다시 그려지며, 인증되지 않은 모든 방문이 처리되는 그 자리에서 /login으로 간다.
 * 옆에 `navigate`를 두면 같은 사건에 길이 둘이 되고, 로그아웃이 실패하는 첫 순간 둘이
 * 어긋난다.
 */
export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut()
  if (error) throw error
}
