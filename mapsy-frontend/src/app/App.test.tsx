/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'

/**
 * 껍데기에 대한 연기 테스트.
 *
 * 이 스위트의 나머지는 일부러 전부 순수 로직이다 — 마크업을 검사하는 렌더 테스트는
 * 자기가 서술하는 마크업보다 빨리 썩는다. 이것은 마크업에 대해 거의 아무것도 검사하지
 * 않는다. `/`에서 트리 전체를 마운트하고 홈 화면이 반대편으로 나왔는지만 본다.
 *
 * 존재 이유는 프로바이더에 Ark UI 토스트 그룹이 들어 있고 화면이 Ark의 다이얼로그 위에
 * 지어져 있다는 것이다. 그것들은 마운트 때 도는 상태 머신이고, 설정이 틀리면 던진다 —
 * 스타일이 틀린 컴포넌트는 그냥 이상해 보일 뿐인 것과 다르다. `pnpm build`는 둘을
 * 구분하지 못하고 이것은 한다.
 */

/**
 * 미리보기 모드로 고정한다.
 *
 * 장식이 아니다. `isSupabaseConfigured`는 `import.meta.env`에서 읽히고, 모든 워크트리는
 * post-checkout 훅이 복사해준 진짜 `.env.local`을 받는다. 그대로 두면 이 테스트는 누구
 * 기계에서 도느냐에 따라 통과하거나 실패하고, 설정된 기계에서는 `auth.getSession()`에
 * 닿아 단위 테스트에서 실제 네트워크를 부른다.
 */
vi.mock('@/shared/api/supabase', () => ({
  isSupabaseConfigured: false,
  getSupabase: () => {
    throw new Error('이 테스트에서는 Supabase를 일부러 막아둠')
  },
}))

// Testing Library가 테스트 사이에 스스로 언마운트하는 것은 vitest가 `globals: true`로
// 돌 때뿐이고 이 프로젝트는 아니다. 없으면 모든 `render`가 트리를 문서에 남겨 두 번째
// 테스트가 모든 것을 두 개씩 본다.
afterEach(cleanup)

describe('App', () => {
  it('옷장과 프로바이더를 던지지 않고 마운트한다', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /내 옷장/ })).toBeDefined()
    expect(screen.getByLabelText('옷 검색')).toBeDefined()
    // FAB가 아니라 빈 화면 자신의 행동 — 옷장이 비어 있는 동안 FAB는 숨으므로
    // 화면이 등록으로 가는 길을 하나만 내준다.
    expect(screen.getByRole('link', { name: /첫 옷 등록하기/ })).toBeDefined()
    expect(screen.queryByLabelText('옷 등록')).toBeNull()
  })

  it('Supabase가 설정되지 않았으면 미리보기 모드라고 말한다', () => {
    render(<App />)

    expect(screen.getByText(/미리보기 모드/)).toBeDefined()
  })

  it('가져올 것이 없으면 스피너가 아니라 빈 화면을 내준다', () => {
    render(<App />)

    // 자격 증명이 없으면 `useWardrobe`가 꺼지므로 쿼리가 가져오는 상태에 들어가지
    // 않는다. 여기서 스켈레톤에 멈춘 홈 화면은 게이트와 쿼리가 백엔드의 유무에 대해
    // 어긋났다는 뜻이다.
    expect(screen.getByText('아직 등록한 옷이 없어요')).toBeDefined()
  })
})
