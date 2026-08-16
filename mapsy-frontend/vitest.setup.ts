import { vi } from 'vitest'

/**
 * jsdom에는 두 옵저버가 모두 없어서, 그것을 쓰는 컴포넌트가 테스트에서만 마운트 때 던진다.
 *
 * `useScrolledPast` 안의 가드가 아니라 여기서 스텁으로 둔다. mapsy가 노리는 모든
 * 브라우저(PRD §9)에 둘 다 오래전부터 있으므로, 훅 안의 `typeof … === 'undefined'`
 * 분기는 정확히 이 환경 하나를 위한 분기가 된다.
 *
 * 스텁은 아무것도 관찰하지 않고 콜백도 하지 않아, 모든 테스트가 스크롤되지 않은 상태를
 * 본다 — 갓 그려진 페이지의 옳은 시작 상태이고, 레이아웃 없는 테스트가 검사할 수 있는
 * 유일한 상태이기도 하다.
 */
class NeverObserves {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

vi.stubGlobal('IntersectionObserver', NeverObserves)
vi.stubGlobal('ResizeObserver', NeverObserves)
