/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppProviders } from './AppProviders'

/**
 * 인증 리스너가 실제로 마운트되는가, 그리고 그것이 던져도 앱이 빈 문서가 되지 않는가.
 *
 * 구독을 `useSession` 밖으로 올리면서 "구독은 한 곳에서 한 번"이 계약이 됐다. 그 한 곳이
 * 사라져도 화면은 멀쩡히 그려진다 — 로그아웃이 아무 일도 안 한 것처럼 보일 뿐이라
 * 렌더 테스트로는 잡히지 않는다. 그래서 여기서 잡는다.
 */

const { auth, createClientThrows } = vi.hoisted(() => ({
  auth: { onAuthStateChange: vi.fn() },
  createClientThrows: { value: false },
}))

vi.mock('@/shared/api/supabase', () => ({
  isSupabaseConfigured: true,
  getSupabase: () => {
    // 값은 있는데 형식이 틀린 `VITE_SUPABASE_URL`에 실제로 `createClient`가 던지는 자리.
    if (createClientThrows.value) throw new Error('Invalid supabaseUrl')
    return { auth }
  },
}))

// 억제를 afterEach에서 되돌린다 — 단언 뒤에 두면 그 단언이 실패하는 순간 억제가
// 다음 테스트로 새고, 진단할 것을 진단하지 못하게 만든다.
let silencedConsole: { mockRestore: () => void } | undefined

afterEach(() => {
  cleanup()
  silencedConsole?.mockRestore()
  silencedConsole = undefined
  createClientThrows.value = false
  vi.clearAllMocks()
})

describe('AppProviders', () => {
  it('인증 리스너를 마운트한다 — 이것이 없으면 로그아웃이 아무 일도 하지 않는다', () => {
    auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })

    render(<AppProviders>{null}</AppProviders>)

    expect(auth.onAuthStateChange).toHaveBeenCalled()
  })

  it('리스너가 던져도 에러 화면이 나온다 — 경계 밖이면 빈 문서가 된다', () => {
    createClientThrows.value = true
    // 경계가 잡은 것을 `componentDidCatch`가 찍는다. 기대한 출력이라 테스트 로그에서 뺀다.
    silencedConsole = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<AppProviders>{null}</AppProviders>)

    expect(screen.getByText('문제가 생겼어요')).toBeTruthy()
  })
})
