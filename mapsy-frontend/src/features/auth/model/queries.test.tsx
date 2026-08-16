/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthListener, useSession } from './queries'

/**
 * 인증 게이트가 무엇을 언제 말하는가.
 *
 * 이 훅이 `anonymous`라고 말하는 순간 `AppLayout`이 /login으로 보낸다. 그래서 아직 모르는
 * 상태와 없다고 아는 상태를 가르는 것이 화면 전환 하나이고, 백엔드가 없는 미리보기 모드는
 * 그 어느 쪽도 아니다.
 */

const { configured, auth } = vi.hoisted(() => ({
  configured: { value: true },
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    unsubscribe: vi.fn(),
  },
}))

vi.mock('@/shared/api/supabase', () => ({
  get isSupabaseConfigured() {
    return configured.value
  },
  getSupabase: () => ({ auth }),
}))

const session = { user: { id: 'u1' } } as Session

function renderSession(hook: () => unknown = useSession) {
  // 재시도를 앱과 같게 둔다(`AppProviders`의 `retry: 2`) — 훅이 스스로 끄는 것이
  // 여기서 꺼두면, 그 한 줄을 지워도 아무것도 달라지지 않는다.
  const client = new QueryClient({ defaultOptions: { queries: { retry: 2 } } })
  return renderHook(hook, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
}

// vitest가 `globals: true`가 아니라 RTL이 스스로 언마운트하지 않는다 — 없으면 트리가
// 문서에 남아 다음 테스트의 리스너와 겹친다.
afterEach(() => {
  cleanup()
  configured.value = true
  vi.clearAllMocks()
})

describe('useSession', () => {
  it('저장된 토큰을 읽는 동안은 없다고 말하지 않는다', async () => {
    auth.getSession.mockReturnValue(new Promise(() => {}))

    const { result } = renderSession()

    expect(result.current).toEqual({ status: 'loading' })
  })

  it('토큰이 있으면 authenticated', async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null })

    const { result } = renderSession()

    await waitFor(() => expect(result.current).toEqual({ status: 'authenticated', session }))
  })

  it('토큰이 없으면 anonymous', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })

    const { result } = renderSession()

    await waitFor(() => expect(result.current).toEqual({ status: 'anonymous' }))
  })

  /**
   * 저장된 토큰을 읽는 일이라, 실패했다면 다시 물어도 같은 답이다. 재시도를 켜두면
   * 로그인 화면에 닿기까지 백오프만큼 로딩에 붙잡혀 있게 된다.
   *
   * 호출 횟수까지 보는 것은 의도다 — 도달만 단언하면 백오프가 `waitFor` 타임아웃
   * 안에 들어오는 날 조용히 통과한다.
   */
  it('세션을 못 읽으면 기다리지 않고 anonymous로 내려간다', async () => {
    auth.getSession.mockRejectedValue(new Error('storage unavailable'))

    const { result } = renderSession()

    await waitFor(() => expect(result.current).toEqual({ status: 'anonymous' }))
    expect(auth.getSession).toHaveBeenCalledOnce()
  })

  it('미리보기 모드는 anonymous가 아니라 unconfigured이고, 백엔드를 부르지 않는다', () => {
    configured.value = false

    const { result } = renderSession()

    expect(result.current).toEqual({ status: 'unconfigured' })
    expect(auth.getSession).not.toHaveBeenCalled()
  })
})

describe('useAuthListener', () => {
  function captureListener() {
    let notify!: (event: string, next: Session | null) => void
    auth.onAuthStateChange.mockImplementation((cb: typeof notify) => {
      notify = cb
      return { data: { subscription: { unsubscribe: auth.unsubscribe } } }
    })
    return () => notify
  }

  it('OAuth 왕복에서 돌아온 세션이 캐시에 들어간다', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    const listener = captureListener()

    const { result } = renderSession(() => {
      useAuthListener()
      return useSession()
    })

    await waitFor(() => expect(result.current).toEqual({ status: 'anonymous' }))
    act(() => listener()('SIGNED_IN', session))

    // 관찰자 통지는 예약된다 — 캐시에 쓰인 순간과 훅이 다시 그려지는 순간이 다르다.
    await waitFor(() => expect(result.current).toEqual({ status: 'authenticated', session }))
  })

  it('로그아웃이 세션을 지운다 — 게이트가 다시 그려지는 것이 이 한 줄에 달려 있다', async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null })
    const listener = captureListener()

    const { result } = renderSession(() => {
      useAuthListener()
      return useSession()
    })

    await waitFor(() => expect(result.current).toEqual({ status: 'authenticated', session }))
    act(() => listener()('SIGNED_OUT', null))

    await waitFor(() => expect(result.current).toEqual({ status: 'anonymous' }))
  })

  /**
   * 취소 한 줄이 막는 것.
   *
   * 위의 두 경우는 `getSession`이 끝난 뒤에 이벤트가 온다. 취소가 존재하는 이유는 그
   * 반대 순서다 — OAuth 왕복은 전체 페이지 로드라, 돌아온 직후의 `getSession`이 아직
   * 날아가는 중에 리스너가 세션을 받는다. 그 스냅숏은 로그인 전에 찍혔다.
   *
   * 덮이면 방금 로그인한 사람이 익명으로 보이고 `AppLayout`이 /login으로 되돌린다.
   */
  it('아직 날아가던 getSession이 뒤늦게 도착해도 방금 받은 세션을 덮지 못한다', async () => {
    let deliverStaleSnapshot!: () => void
    auth.getSession.mockReturnValue(
      new Promise((resolve) => {
        deliverStaleSnapshot = () => resolve({ data: { session: null }, error: null })
      }),
    )
    const listener = captureListener()

    const { result } = renderSession(() => {
      useAuthListener()
      return useSession()
    })

    await waitFor(() => expect(auth.onAuthStateChange).toHaveBeenCalled())
    expect(result.current).toEqual({ status: 'loading' })

    // 도달 단언 — 리스너가 썼다는 것을 기다려서 확인한다.
    act(() => listener()('SIGNED_IN', session))
    await waitFor(() => expect(result.current).toEqual({ status: 'authenticated', session }))

    // 부정 단언 — 늦은 답에 덮을 기회를 다 준 뒤 한 번만 본다. `waitFor`로 보면
    // 덮이기 전에 통과해버린다.
    await act(async () => {
      deliverStaleSnapshot()
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(result.current).toEqual({ status: 'authenticated', session })
  })

  it('읽기만 하는 useSession은 구독하지 않는다', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    captureListener()

    renderSession()

    expect(auth.onAuthStateChange).not.toHaveBeenCalled()
  })

  it('미리보기 모드에서는 구독하지 않는다', () => {
    configured.value = false

    renderSession(useAuthListener)

    expect(auth.onAuthStateChange).not.toHaveBeenCalled()
  })

  it('언마운트가 구독을 끊는다', () => {
    captureListener()

    renderSession(useAuthListener).unmount()

    expect(auth.unsubscribe).toHaveBeenCalledOnce()
  })
})
