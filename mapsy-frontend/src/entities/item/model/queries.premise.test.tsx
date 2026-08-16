/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * 이미 데이터를 가진 쿼리의 갱신이 실패했을 때 react-query가 무엇을 보고하는가 —
 * `WardrobePage`가 자기 화면을 가르는 전제.
 *
 * 그 화면은 답이 도착했으면 격자를 그리고 캐시된 것이 없을 때만 화면을 갈아치우는데,
 * 그 가름이 옳으려면 `error`가 `data` *대신*이 아니라 *함께* 와야 한다. 실제로 그렇다.
 * 화면 자신의 테스트로는 세울 수 없다 — `useWardrobe`를 목으로 바꿔 원하는 조합을
 * 건네므로, 스스로 지어낸 전제에 대한 반응을 검사할 뿐이다.
 *
 * 아래 훅이 화면과 같은 방식으로 필드를 읽는 것은 문체가 아니라 필수다. react-query v5는
 * 렌더가 실제로 만진 프로퍼티만 추적해 그것에만 다시 그리므로, `error`를 읽지 않고 쿼리
 * 객체를 돌려주는 훅은 `error`가 나타나도 다시 그려지지 않는다 — `result.current`가
 * 실패 이전 스냅숏에 머물러 `status: 'success'`, `error: null`을 보고한다.
 */
describe('react-query — 옷장이 딛고 선 전제', () => {
  it('이미 가진 데이터 옆에 `error`를 세우고 `isLoading`으로 돌아가지 않는다', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const queryFn = vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValueOnce(['마산 플리스'])
      .mockRejectedValue(new Error('offline'))

    const { result } = renderHook(
      () => {
        const query = useQuery({ queryKey: ['premise'], queryFn })
        return {
          data: query.data,
          error: query.error,
          isLoading: query.isLoading,
          isFetching: query.isFetching,
          refetch: query.refetch,
        }
      },
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    )

    await waitFor(() => expect(result.current.data).toBeDefined())
    await result.current.refetch()
    await waitFor(() => expect(result.current.isFetching).toBe(false))

    // 버그를 만든 상태에서 화면이 읽는 세 사실 — 손에 남은 행, 알릴 실패, 스켈레톤을
    // 그릴 이유 없음.
    expect(result.current.data).toEqual(['마산 플리스'])
    // `not.toBeNull()`이 아니라 `toBeInstanceOf` — 그쪽은 `!== null`이라, 실패를
    // `undefined`로 보고하는 업그레이드가 오면 이 테스트는 통과한 채 화면의
    // `error != null`만 조용히 안 맞게 되고 실패가 언급되지 않는다.
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.isLoading).toBe(false)
  })
})
