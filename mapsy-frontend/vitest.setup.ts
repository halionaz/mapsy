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

/**
 * jsdom 30에는 `<dialog>`의 열고 닫는 메서드가 없다 — 프로퍼티가 `undefined`라
 * 부르면 TypeError다. 사진 뷰어가 네이티브 `<dialog>`이므로 그것을 그리는 테스트는
 * 마운트에서 죽는다. 진짜 브라우저에는 다 있는 API라는 점에서 위 옵저버들과 같다.
 *
 * 다만 이쪽은 가드가 필요하다. `stubGlobal`은 없는 전역을 만들어 주지만 여기서는
 * 있는 것의 prototype에 손대므로, node 환경으로 도는 테스트 파일에서 이 줄이
 * ReferenceError로 죽는다 — 이 파일은 환경과 무관하게 모든 테스트에서 돈다.
 *
 * `open`을 직접 뒤집는 것은 jsdom이 그 속성은 구현하기 때문이다 — 열림 여부를 읽는
 * 코드가 스텁 뒤에서도 참말을 듣는다.
 *
 * **`close`가 이벤트를 쏘는 것이 이 스텁에서 가장 중요한 한 줄이다.** 명세의 `close()`는
 * 대상에 `close` 이벤트를 발생시키고, `PhotoViewer`에서 `onClose`에 닿는 길은 그 이벤트
 * 하나뿐이다(X 버튼도 `dialogRef.current?.close()`를 부를 뿐이다). 이벤트를 빠뜨리면
 * 멀쩡한 닫기가 테스트에서만 죽고, 원인이 프로덕션 코드가 아니라 이 가짜라는 것을 찾기
 * 어렵다 — 최악은 `onClose`를 직접 부르도록 진짜 코드를 고치는 오판이다.
 *
 * top layer·inert·포커스 트랩은 흉내내지 못한다. 그건 jsdom의 한계라 여기서 메울 수 없다.
 */
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true
  }
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
