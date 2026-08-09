import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'

import { Button } from '@/shared/ui/Button'
import { EmptyState } from '@/shared/ui/EmptyState'

/**
 * The last thing between a thrown render and a white page.
 *
 * React unmounts the whole tree when a render throws and nothing catches it, so
 * without this the app's answer to any unexpected error is a blank document with
 * no way back — worse than the screen that failed. The app had no boundary at
 * all, which also made `assertNever`'s promise of "an honest error rather than a
 * screen rendering nothing" untrue wherever it was used.
 *
 * A class, because `getDerivedStateFromError` has no hook equivalent.
 *
 * Recovery is a reload rather than a retry. The boundary cannot know what the
 * throw left half-done — a mutation mid-flight, a store partly written — and
 * offering to re-render the same tree over that state is offering to fail again.
 * Reloading is the one action that is definitely safe, and the wardrobe comes
 * straight back from the server.
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
    // The only record there is. mapsy ships no error reporting, so this is what
    // a bug report gets to quote from.
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
