import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'

/**
 * 던져진 렌더와 흰 화면 사이의 마지막 것.
 *
 * 렌더가 던지고 아무도 잡지 않으면 React는 트리 전체를 언마운트한다. 이것이 없으면
 * 예상치 못한 에러에 대한 앱의 답은 돌아갈 길 없는 빈 문서이고, 그것은 실패한 화면보다 나쁘다.
 *
 * 클래스인 것은 `getDerivedStateFromError`에 대응하는 훅이 없기 때문이다.
 *
 * 복구는 재시도가 아니라 새로고침이다. 경계는 그 던짐이 무엇을 절반만 해놓았는지 알 수
 * 없고 — 날아가던 뮤테이션, 절반쯤 쓰인 스토어 — 그 상태 위에 같은 트리를 다시 그리자고
 * 제안하는 것은 다시 실패하자는 제안이다.
 */
interface ErrorBoundaryState {
  failed: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 남는 유일한 기록. mapsy에는 에러 리포팅이 없으므로 버그 리포트가 인용할 것이 이것뿐이다.
    console.error('[mapsy] unhandled render error', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <EmptyState
        tone="danger"
        icon={<TriangleAlert size={24} />}
        title="문제가 생겼어요"
        description="화면을 그리다 예상하지 못한 오류가 났어요. 다시 불러오면 대부분 해결돼요."
        action={
          <Button variant="outline" onClick={() => window.location.reload()}>
            다시 불러오기
          </Button>
        }
      />
    )
  }
}
