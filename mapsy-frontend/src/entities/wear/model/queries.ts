import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { isSupabaseConfigured } from '@/shared/api/supabase'
import * as api from '../api/wearApi'
import { wearKeys } from './queryKeys'
import type { WearEntry } from './types'

/**
 * 착용 기록의 쿼리 계층.
 *
 * 모든 착용을 담은 캐시 엔트리 하나를 두 뮤테이션이 제자리에서 기운다 — 각 패치 앞의
 * `cancelQueries`와 뒤의 조건부 invalidate에 대한 근거는
 * `entities/item/model/queries.ts`에 있다. 여기서 다른 것은 패치가 하는 일뿐이다.
 */

export function useWears() {
  return useQuery<WearEntry[]>({
    queryKey: wearKeys.list(),
    queryFn: api.fetchWears,
    // 미리보기 모드에는 물어볼 백엔드가 없다.
    enabled: isSupabaseConfigured,
  })
}

/**
 * 지워진 옷의 착용 기록을 캐시에서 걷어낸다.
 *
 * DB는 이 행을 옷과 함께 캐스케이드로 지우므로(`item_wears_item_fk ... on delete
 * cascade`), 그것을 붙들고 있는 캐시는 스키마와 어긋난 캐시다. 어긋난 채로 두면 착용
 * 버튼이 없는 옷을 세고, 그날을 열면 카드 없는 id가 선택에 실려 해제할 수 없으며,
 * 제출은 `item_wears_item_fk`에서 죽어 함수 전체가 롤백된다 — 그날을 아예 기록할 수 없다.
 *
 * 두 엔티티를 엮는 곳은 `features/item-delete`다. 여기는 착용 캐시를 어떻게 고치는지만
 * 안다. 취소가 필요한 이유는 다른 뮤테이션과 같다 — 날아가던 fetch가 삭제 이전의 행을
 * 들고 있어 유령을 곧장 되돌려 놓는다.
 */
export async function dropItemWears(queryClient: QueryClient, itemId: string): Promise<void> {
  await queryClient.cancelQueries({ queryKey: wearKeys.all })
  queryClient.setQueryData<WearEntry[]>(wearKeys.list(), (entries) =>
    entries ? entries.filter((entry) => entry.itemId !== itemId) : entries,
  )
}

function useWearCache() {
  const queryClient = useQueryClient()

  return {
    queryClient,
    before: () => queryClient.cancelQueries({ queryKey: wearKeys.all }),
    after: () => {
      if (queryClient.getQueryData<WearEntry[]>(wearKeys.list()) === undefined) {
        void queryClient.invalidateQueries({ queryKey: wearKeys.all })
      }
    },
    patch: (update: (entries: WearEntry[]) => WearEntry[]) =>
      queryClient.setQueryData<WearEntry[]>(wearKeys.list(), (entries) =>
        entries ? update(entries) : entries,
      ),
  }
}

/**
 * 하루를 제출한다 — 이 옷들, 그날, 그리고 그것뿐.
 *
 * 일부러 **낙관적이지 않다**. 옷장의 다른 네 뮤테이션은 낙관적이고, 그 이유가 여기서는
 * 반대로 작동한다. 그쪽은 한 행의 한 필드를 바꾸므로 되돌리면 사용자가 여전히 볼 수 있는
 * 것이 돌아온다. 이쪽은 하루를 통째로 다시 쓰고, 되돌려야 할 상태는 화면이 방금 떠난
 * 상태다. 여기서 실패하면 사용자는 고른 것을 손에 든 채로 남아야 한다.
 */
export function useSetWears() {
  const { patch, before, after } = useWearCache()

  return useMutation({
    mutationFn: ({ wornOn, itemIds }: { wornOn: string; itemIds: string[] }) =>
      api.setWears(wornOn, itemIds),

    onSuccess: async (_data, { wornOn, itemIds }) => {
      await before()
      // 함수가 한 대로 그날을 통째로 갈아치운다. 순서는 보존하지 않는다 — 아무도 읽지
      // 않는다. `summarizeWears`는 최댓값을 취하고 `itemIdsWornOn`은 집합을 만든다.
      patch((entries) => [
        ...entries.filter((entry) => entry.wornOn !== wornOn),
        ...itemIds.map((itemId) => ({ itemId, wornOn })),
      ])
      after()
    },
  })
}

/**
 * 상세 화면에서 옷 하나를 하루에 대해 토글한다.
 *
 * 위 제출과 달리 낙관적이다 — 사실 하나가 뒤집히는 것이고, 옆의 별도 같게 동작하며,
 * 쓰기가 거절되면 되돌려 놓을 컨트롤이 눈앞에 있다.
 */
export function useToggleWear() {
  const { queryClient, patch, before, after } = useWearCache()

  return useMutation({
    mutationFn: ({
      itemId,
      userId,
      wornOn,
      worn,
    }: {
      itemId: string
      userId: string
      wornOn: string
      worn: boolean
    }) => (worn ? api.addWear(itemId, userId, wornOn) : api.removeWear(itemId, wornOn)),

    onMutate: async ({ itemId, wornOn, worn }) => {
      await before()
      const previous = queryClient.getQueryData<WearEntry[]>(wearKeys.list())
      patch((entries) => {
        const without = entries.filter(
          (entry) => !(entry.itemId === itemId && entry.wornOn === wornOn),
        )
        return worn ? [...without, { itemId, wornOn }] : without
      })
      return { previous }
    },

    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(wearKeys.list(), context.previous)
      }
    },

    onSettled: after,
  })
}
