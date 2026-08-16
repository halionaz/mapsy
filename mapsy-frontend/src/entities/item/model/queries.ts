import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { isSupabaseConfigured } from '@/shared/api/supabase'
import { errorMessage } from '@/shared/lib/errorMessage'
import * as api from '../api/itemApi'
import { wardrobeKeys } from './queryKeys'
import {
  addPending,
  getPending,
  markPendingState,
  removePending,
  type PendingUpload,
} from './pendingUploads'
import type { PhotoEntry } from './photoEntries'
import type { ItemDraft, ItemStatus, ItemWithImages, WardrobeItem } from './types'

/**
 * 옷장의 쿼리 계층.
 *
 * 컬렉션을 한 번 통째로 받아 클라이언트에서 거르므로(PRD §8.4) 모든 화면이 읽는 캐시
 * 엔트리는 하나다. 뮤테이션은 그 엔트리를 직접 기우고 기울 것이 없었을 때만 다시
 * 불러온다 — 갱신은 모든 커버 URL을 재서명해 격자 전체를 다시 로드시킨다.
 *
 * 진행 중인 등록은 일부러 이 캐시 밖이다 — 이유는 `pendingUploads.ts`.
 * 키는 `./queryKeys`에 있다. 호출부마다 적어둔 키는 어긋나는 순간 조용한 무효 연산이 된다.
 */

export function useWardrobe() {
  return useQuery<WardrobeItem[]>({
    queryKey: wardrobeKeys.list(),
    queryFn: api.fetchWardrobe,
    // 미리보기 모드에는 물어볼 백엔드가 없다. 이게 없으면 쿼리가 돌고 `getSupabase()`가
    // 던져, 백엔드 없이도 UI를 둘러볼 수 있다는 약속이 깨진다.
    enabled: isSupabaseConfigured,
  })
}

/**
 * 캐시된 컬렉션을 제자리에서 기운다.
 *
 * 엔트리가 없을 때 입력을 그대로 돌려주는 것은 의도다. react-query는 updater가
 * undefined를 반환하면 쓰기를 버리고, 여기서 배열을 지어내면 방금 건드린 행 하나만 든
 * "옷장"을 발행하게 된다. 쓰기를 잃으면 안 되는 호출부는 대신 invalidate한다.
 */
function patchCache(
  queryClient: ReturnType<typeof useQueryClient>,
  update: (entries: WardrobeItem[]) => WardrobeItem[],
) {
  queryClient.setQueryData<WardrobeItem[]>(wardrobeKeys.list(), (entries) =>
    entries ? update(entries) : entries,
  )
}

/**
 * 캐시를 기울 때 모든 뮤테이션에 필요한 것.
 *
 * `before` — 이미 날아가고 있는 fetch는 뮤테이션 이전의 스냅숏을 들고 있어서, 응답이
 * 도착하면 그 사이에 기운 것을 덮는다. 취소가 그 경합을 닫고 값도 싸서 다섯 모두 한다.
 * `refetchOnWindowFocus`가 그 경합을 평범한 사용에서 닿게 만든다 — 앱이 앞으로 나오는
 * 순간, 즉 하던 일을 이어가는 바로 그때 다시 불러온다.
 *
 * `after` — 기울 엔트리가 없었을 때만. 실제로는 `useCreateItem`뿐이다. 나머지 넷은 이미
 * 컬렉션을 읽는 화면에서 닿으므로 캐시가 구조적으로 따뜻하다. 조건 없는 invalidate는
 * 깔끔해 보이지만 비싸다 — `useWardrobe`는 옷장을 읽는 화면에서 늘 활성이라, 별 탭
 * 하나마다 컬렉션 전체를 다시 받고 모든 커버 URL을 재서명해 격자의 모든 썸네일을 다시
 * 로드한다.
 */
function useCachePatch() {
  const queryClient = useQueryClient()

  return {
    queryClient,
    // `list()`가 아니라 `all` — 취소와 무효화는 접두사로 맞추므로, 나중에 옷장 쿼리가
    // 하나 더 생겨도 여기를 건드릴 필요가 없다.
    before: () => queryClient.cancelQueries({ queryKey: wardrobeKeys.all }),
    after: () => {
      const cached = queryClient.getQueryData<WardrobeItem[]>(wardrobeKeys.list())
      if (cached === undefined) {
        void queryClient.invalidateQueries({ queryKey: wardrobeKeys.all })
      }
    },
  }
}

export function useCreateItem() {
  const { queryClient, before, after } = useCachePatch()

  return useMutation({
    mutationFn: ({ pending }: { pending: PendingUpload }) =>
      api.createItem(pending.draft, pending.photos, pending.userId),

    onMutate: ({ pending }) => {
      addPending({ ...pending, state: 'uploading' })
    },

    onSuccess: async (created, { pending }) => {
      // 그냥 앞에 붙이면 두 가지로 잃는다 — 날아가던 refetch가 도착하며 덮거나, 폼이
      // 열려 있는 동안 캐시 엔트리가 비워져 쓰기가 통째로 버려지거나. 어느 쪽이든
      // `removePending`이 카드를 걷어가며 미리보기 URL까지 반납한다.
      //
      // `before`가 첫째를, `after`가 둘째를 닫는다.
      await before()
      patchCache(queryClient, (entries) => [created, ...entries])
      removePending(pending.tempId)
      after()
    },

    onError: (error, { pending }) => {
      // 항목은 사라지지 않고 보이는 채로 남는다 — 재시도 버튼은 볼 수 있는 무언가에
      // 붙어야 하고, blob도 함께 남아야 한다. 이유도 같이 남긴다. 제약 위반("메모가
      // 너무 김")은 몇 번을 다시 해도 똑같이 실패하고, 메시지가 없으면 재시도가
      // 무의미하다는 것을 알 길이 없다.
      markPendingState(pending.tempId, 'failed', errorMessage(error))
    },
  })
}

/** 실패한 등록을 이미 처리된 blob으로 다시 시도한다. */
export function useRetryUpload() {
  const create = useCreateItem()

  return (tempId: string) => {
    const pending = getPending(tempId)
    if (!pending || pending.state !== 'failed') return
    create.mutate({ pending })
  }
}

/** 실패한 업로드를 버리고 미리보기 URL을 반납한다. */
export function useDiscardUpload() {
  return (tempId: string) => removePending(tempId)
}

/**
 * 편집 폼의 저장 — 필드, 그리고 사진 목록이 바뀌었을 때만 사진.
 *
 * 필드가 먼저인 것은 그쪽이 되풀이해도 되는 싼 요청이라, 위반이 있으면 아무것도 올리거나
 * 지우기 전에 실패하기 때문이다. 반대 순서는 거절당할 메모의 값을 사진 업로드로 치른다.
 *
 * 둘은 원자적이지 않지만 재시도가 수렴한다 — 필드 갱신은 멱등이고 `set_item_images`는
 * 델타가 아니라 목록 전체를 받는다.
 *
 * 사진이 바뀌었는지는 여기서 답할 수 없다. 이 캐시는 창 포커스에 다시 불러오므로, 화면이
 * 열린 사이 다른 기기가 더한 사진이 사용자가 낸 차이처럼 보인다 — `samePhotoList` 참고.
 */
export function useUpdateItem() {
  const { queryClient, before, after } = useCachePatch()

  return useMutation({
    mutationFn: async (vars: {
      item: ItemWithImages
      draft: ItemDraft
      /** 폼의 사진 목록. 커버가 먼저. */
      photos: PhotoEntry[]
      /** 그 목록이 폼이 열릴 때와 다른지. */
      photosChanged: boolean
    }) => {
      const updated = await api.updateItem(vars.item.id, vars.draft)
      const photos = vars.photosChanged ? await api.setItemPhotos(vars.item, vars.photos) : null
      return { updated, photos }
    },
    onSuccess: async ({ updated, photos }) => {
      await before()
      patchCache(queryClient, (entries) =>
        entries.map((entry) =>
          entry.id === updated.id ? { ...entry, ...updated, ...(photos ?? {}) } : entry,
        ),
      )
      after()
    },
  })
}

export function useSetFavorite() {
  const { queryClient, before, after } = useCachePatch()

  return useMutation({
    mutationFn: (vars: { id: string; isFavorite: boolean }) =>
      api.setFavorite(vars.id, vars.isFavorite),
    onMutate: async ({ id, isFavorite }) => {
      await before()
      const previous = queryClient.getQueryData<WardrobeItem[]>(wardrobeKeys.list())
      patchCache(queryClient, (entries) =>
        entries.map((entry) => (entry.id === id ? { ...entry, isFavorite } : entry)),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(wardrobeKeys.list(), context.previous)
      }
    },
    // 캐시가 비어 있을 때만 무언가 한다. 별을 누르려면 상세 화면이 그 캐시에서 옷을
    // 찾았어야 하므로 평소에는 닿지 않는다. 거절된 쓰기는 위 onError가 이미 되돌리므로
    // 레시피의 흔한 "서버와 다시 맞추기" 단계가 아니다.
    onSettled: after,
  })
}

export function useSetStatus() {
  const { queryClient, before, after } = useCachePatch()

  return useMutation({
    mutationFn: (vars: { id: string; status: ItemStatus }) => api.setStatus(vars.id, vars.status),
    onSuccess: async (_data, { id, status }) => {
      await before()
      patchCache(queryClient, (entries) =>
        entries.map((entry) => (entry.id === id ? { ...entry, status } : entry)),
      )
      after()
    },
  })
}

/**
 * 옷 행과 사진을 지우고, 옷장 캐시에서 걷어낸다.
 *
 * 착용 기록 캐시는 건드리지 않는다 — DB는 그 행을 함께 캐스케이드하지만 이 엔티티는
 * 그것을 모른다. 두 캐시를 함께 맞추는 것은 `features/item-delete`의 `useDeleteItem`이고,
 * 화면은 그쪽을 쓴다.
 */
export function useDeleteItemRow() {
  const { queryClient, before, after } = useCachePatch()

  return useMutation({
    mutationFn: (vars: { id: string; userId: string }) => api.deleteItem(vars.id, vars.userId),
    // 이게 없으면 가장 눈에 띈다 — 삭제 이전 스냅숏을 든 fetch가 도착하며 옷을 격자에
    // 되돌려 놓는다. 에러도 없고 재시도할 것도 없다. 행은 정말로 사라졌으므로 다음
    // 갱신에 다시 사라진다.
    onSuccess: async (_data, { id }) => {
      await before()
      patchCache(queryClient, (entries) => entries.filter((entry) => entry.id !== id))
      after()
    },
  })
}
