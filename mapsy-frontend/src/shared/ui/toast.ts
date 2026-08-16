import { createToaster } from '@ark-ui/react'

/**
 * 앱의 유일한 토스트 큐.
 *
 * 컨텍스트가 아니라 모듈 수준 스토어인 것은 말을 걸어야 하는 쪽(뮤테이션의 `onError`,
 * 끝난 업로드)이 컴포넌트가 아니라 콜백이기 때문이다. `<Toaster />`는 프로바이더에서
 * 한 번 마운트되어 여기를 구독한다.
 *
 * 토스트는 사용자가 대응하지 않아도 되는 것 전용이다. 결정이 필요하면 다이얼로그이고,
 * 폼 제출의 답이면 폼 옆에 남는다 — 필드를 읽는 동안 미끄러져 사라지는 메시지는
 * 전달되지 않은 메시지다.
 */
export const toaster = createToaster({
  placement: 'bottom',
  overlap: false,
  max: 3,
  gap: 10,
  duration: 3200,
  // 옷장 화면의 FAB를 비켜간다. 인셋을 여기서 더해야 하는 이유는 zag가 오프셋을
  // 합이 아니라 `max(env(safe-area-inset-bottom), offset)`으로 풀기 때문이다 —
  // 고정값만 두면 FAB는 인셋만큼 올라가는데 토스트는 제자리에 남아 버튼을 덮는다.
  offsets: {
    top: '1rem',
    bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
    left: '1rem',
    right: '1rem',
  },
})
