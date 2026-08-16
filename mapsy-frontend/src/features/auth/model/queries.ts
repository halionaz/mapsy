import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'

import { getSupabase, isSupabaseConfigured } from '@/shared/api/supabase'
import * as api from '../api/authApi'
import { authKeys } from './queryKeys'

/**
 * 인증의 쿼리 계층 — PRD §3.
 *
 * 세션도 서버 상태라 캐시 엔트리 하나에 둔다. 훅마다 `useState` + `getSession`을 두던
 * 시절에는 호출부마다 따로 물었다. 이제 몇 곳에서 부르든 요청은 한 번이고 답은 하나다.
 *
 * 그 엔트리에 쓰는 것이 둘이다 — 최초 `getSession`, 그리고 `useAuthListener`. 후자가
 * OAuth 리다이렉트로 돌아온 세션과 로그아웃을 모두 실어 나른다.
 */

/**
 * 현재 인증 상태.
 *
 * `unconfigured`가 에러가 아니라 일급 상태인 것은, 그것이 없으면 Supabase 프로젝트가
 * 생기기 전까지 앱을 쓸 수 없어 UI를 만들 수 없기 때문이다. 화면은 그것을 미리보기 모드로
 * 취급하고 그냥 그린다.
 *
 * `loading`이 필요한 것은 저장된 토큰을 읽는 일이 비동기이기 때문이다. `anonymous`로
 * 합치면 이미 로그인한 사람이 콜드 스타트마다 한 프레임씩 로그인 화면으로 튕긴다.
 */
export type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; session: Session }
  | { status: 'anonymous' }
  | { status: 'unconfigured' }

export function useSession(): SessionState {
  const { data, isPending } = useQuery({
    queryKey: authKeys.session(),
    queryFn: api.fetchSession,
    enabled: isSupabaseConfigured,
    // 세션은 시간이 지나 낡지 않는다 — 바뀌면 `useAuthListener`가 말해준다.
    staleTime: Infinity,
    gcTime: Infinity,
    // 저장된 토큰을 읽는 일이라, 실패했다면 다시 물어도 같은 답이다.
    retry: false,
  })

  if (!isSupabaseConfigured) return { status: 'unconfigured' }
  if (isPending) return { status: 'loading' }
  return data ? { status: 'authenticated', session: data } : { status: 'anonymous' }
}

/**
 * 세션 캐시에 쓰는 유일한 리스너. `AppProviders`가 한 번만 마운트한다.
 *
 * `useSession` 안이 아니라 밖에 있는 것은, 안에 두면 호출부 하나마다 구독이 하나씩 붙고
 * 인증 이벤트가 올 때마다 같은 쓰기가 그 수만큼 반복되기 때문이다. 그리고 읽기만 하는
 * 시그니처가 전역 구독을 설치하는 것은 호출부에서 보이지 않는다.
 */
export function useAuthListener() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const { data: listener } = getSupabase().auth.onAuthStateChange((_event, session) => {
      // 취소하지 않으면 아직 날아가고 있는 `getSession`이 로그인 직후에 도착해, 방금 쓴
      // 세션을 로그인 전 스냅숏으로 덮는다. `queries.test.tsx`가 붙들고 있다.
      void queryClient.cancelQueries({ queryKey: authKeys.all })
      queryClient.setQueryData(authKeys.session(), session)
    })

    return () => listener.subscription.unsubscribe()
  }, [queryClient])
}

export function useSignIn() {
  return useMutation({ mutationFn: api.signInWithGoogle })
}

export function useSignOut() {
  return useMutation({ mutationFn: api.signOut })
}
