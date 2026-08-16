import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

/**
 * `useAuthListener`의 취소가 딛고 선 전제.
 *
 * 리스너는 취소를 기다리지 않고 곧바로 쓴다. 그것이 무엇을 막는지 추론하지 않고 진짜
 * 라이브러리에 대고 검사한다 — 취소를 뺐을 때 실제로 깨지는지, 그리고 취소와 쓰기의
 * 순서가 실제로 중요한지.
 *
 * 깨져도 보이는 증상은 로그인 직후 한 번 /login으로 튕기는 것뿐이라 아무도 신고하지 않는다.
 */

const KEY = ['auth', 'session'] as const

/**
 * 로그인 전에 찍힌 스냅숏을 든 `getSession`이 아직 날아가는 중에 인증 이벤트가 도착한다.
 * 늦게 도착한 스냅숏이 세션을 덮으면 방금 로그인한 사람이 익명으로 보인다.
 */
async function raceListenerAgainstInFlightFetch(order: 'cancel-first' | 'set-first' | 'no-cancel') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  let deliverStaleSnapshot!: () => void
  const inFlight = client
    .fetchQuery({
      queryKey: KEY,
      queryFn: () =>
        new Promise<string | null>((resolve) => {
          deliverStaleSnapshot = () => resolve(null)
        }),
    })
    .catch(() => {})

  if (order === 'cancel-first') void client.cancelQueries({ queryKey: ['auth'] })
  client.setQueryData(KEY, 'signed-in')
  if (order === 'set-first') void client.cancelQueries({ queryKey: ['auth'] })

  deliverStaleSnapshot()
  await inFlight
  return client.getQueryData(KEY)
}

describe('react-query — 인증 리스너의 취소가 딛고 선 전제', () => {
  it('취소하면 뒤늦게 도착한 getSession이 방금 쓴 세션을 덮지 못한다', async () => {
    expect(await raceListenerAgainstInFlightFetch('cancel-first')).toBe('signed-in')
  })

  it('취소를 빼면 덮는다 — 취소가 막는 것이 이것이다', async () => {
    expect(await raceListenerAgainstInFlightFetch('no-cancel')).toBeNull()
  })

  /**
   * 순서는 이 버전에서 결과를 가르지 않는다. `setQueryData`가 manual success로
   * 들어가면서 revert 대상까지 방금 쓴 값으로 바꾸기 때문이다(query.js의
   * `#revertState = action.manual ? newState : void 0`). 취소가 먼저인 쪽은 그 세부에
   * 기대지 않으므로 그대로 둔다.
   */
  it('취소와 쓰기의 순서는 결과를 가르지 않는다', async () => {
    expect(await raceListenerAgainstInFlightFetch('set-first')).toBe('signed-in')
  })
})
