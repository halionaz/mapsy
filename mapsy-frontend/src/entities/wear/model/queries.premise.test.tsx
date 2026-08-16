/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

/**
 * `mutate` 수준의 `onError`가 아직 도는 동안 뮤테이션이 무엇을 보고하는가 —
 * 옷장의 23503 복구가 딛고 선 전제.
 *
 * 그 콜백은 아무 말을 하기 전에 옷장 갱신을 기다리고, 그 기다림 내내 제출 버튼은 바빠
 * 보여야 한다. "바쁨"의 뻔한 출처는 뮤테이션 자신의 `isPending`인데 그것이 틀린
 * 출처다 — 콜백에 들어올 때 뮤테이션은 이미 끝나 있다. 그래서 화면이 두 번째 플래그를
 * 들고, 이것이 그 이유다.
 *
 * 추론하지 않고 진짜 라이브러리에 대고 검사한다. 화면 자신의 테스트는 `useSetWears`를
 * 목으로 바꿔 `isPending: false`를 건네므로 어떤 답에도 동의한다.
 */
describe('react-query — 23503 복구가 딛고 선 전제', () => {
  it('mutate 수준 onError가 돌 때는 이미 isPending을 떠나 있고, 그것을 기다리지도 않는다', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })

    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const seen: Record<string, unknown> = {}

    const { result } = renderHook(
      () => {
        const mutation = useMutation({
          mutationFn: () => Promise.reject(new Error('boom')),
        })
        // 둘 다 매 렌더에서 읽어야 구독이 유지된다 — v5는 렌더가 실제로 만진
        // 프로퍼티에만 다시 그린다.
        return { mutate: mutation.mutate, isPending: mutation.isPending }
      },
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    )

    result.current.mutate(undefined, {
      onError: async () => {
        seen.atEntry = result.current.isPending
        await held
        seen.finished = true
      },
    })

    await waitFor(() => expect(seen.atEntry).toBeDefined())
    seen.whileAwaiting = result.current.isPending

    // 뮤테이션이 이미 끝난 채로 들어왔고, 콜백이 멈춰 있는 동안에도 끝난 채다 —
    // `isPending`의 무엇도 콜백이 하는 일을 서술하지 않는다.
    expect(seen.atEntry).toBe(false)
    expect(seen.whileAwaiting).toBe(false)

    // 그리고 콜백의 promise를 기다리는 것이 없다 — 뮤테이션은 이 줄 전에 끝났고,
    // 그래서 `finished`가 아직 비어 있다.
    expect(seen.finished).toBeUndefined()

    release()
    await held
  })
})
