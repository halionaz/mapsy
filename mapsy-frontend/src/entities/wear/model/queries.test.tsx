/** @vitest-environment jsdom */
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { dropItemWears } from './queries'
import { wearKeys } from './queryKeys'
import type { WearEntry } from './types'

/**
 * `features/item-delete`의 `useDeleteItem`이 집는 것, 그리고 그것이 있어야 하는 이유.
 *
 * DB가 `item_wears`를 옷과 함께 캐스케이드로 지우므로, 그 행을 붙들고 있는 착용 캐시는
 * 스키마와 어긋난다 — 그리고 `staleTime`이 30분이고 포커스 갱신이 그것을 존중하므로
 * 30분 동안 어긋난다. 그 결과는 지워진 옷을 세는 착용 버튼, 카드가 없어 해제할 수 없는
 * id가 심긴 선택, 그리고 `item_wears_item_fk`에서 죽어 함수 전체가 롤백되는 제출이다.
 */
describe('dropItemWears', () => {
  const wears: WearEntry[] = [
    { itemId: 'a', wornOn: '2026-08-14' },
    { itemId: 'b', wornOn: '2026-08-14' },
    { itemId: 'a', wornOn: '2026-08-13' },
  ]

  it('그 옷이 나오는 모든 날을 지우고 그 밖에는 아무것도 지우지 않는다', async () => {
    const client = new QueryClient()
    client.setQueryData(wearKeys.list(), wears)

    await dropItemWears(client, 'a')

    expect(client.getQueryData(wearKeys.list())).toEqual([{ itemId: 'b', wornOn: '2026-08-14' }])
  })

  it('없는 캐시는 지어내지 않고 없는 채로 둔다', async () => {
    // 옷장의 `patchCache`가 따르는 것과 같은 규칙 — react-query는 undefined를 반환하는
    // updater를 버리고, 여기서 배열을 쓰면 이 뮤테이션이 우연히 아는 것만 담은
    // "착용 기록"을 발행하게 된다.
    const client = new QueryClient()

    await dropItemWears(client, 'a')

    expect(client.getQueryData(wearKeys.list())).toBeUndefined()
  })

  it('착용 기록이 없는 옷에는 아무 일도 하지 않는다', async () => {
    const client = new QueryClient()
    client.setQueryData(wearKeys.list(), wears)

    await dropItemWears(client, 'z')

    expect(client.getQueryData(wearKeys.list())).toEqual(wears)
  })
})
