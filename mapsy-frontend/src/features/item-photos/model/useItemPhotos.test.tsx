/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ItemImage } from '@/entities/item'
import { SIGNED_URL_TTL_SECONDS } from '@/shared/api/storage'
import { useItemPhotos } from './useItemPhotos'

/**
 * 이 기능이 옮긴 것이 아니라 다시 쓴 유일한 로직.
 *
 * `photoSlots`의 세 줄짜리 규칙이 양방향으로 한 번씩 틀렸었고, 그것이 틀렸던 URL을 이제
 * 이 훅이 만든다. 여기서 붙드는 것은 렌더링이 아니라 화면이 조용히 기대는 네 가지다 —
 * 사진 없는 옷이 영원히 기다리지 않고 정착하는 것, 캐시 패치가 재서명하지 않는 것,
 * 새 서명이 로드에 실패했던 사진을 용서하는 것, 실패가 실패로 정착하는 것.
 *
 * 참조 동일성 검사가 값 검사만큼 중요하다. 뷰어에서 스와이프하면 화면이 매 프레임 다시
 * 그려지고, 뷰어는 `slots`의 identity가 바뀔 때마다 키 핸들러를 다시 짓는다.
 */

const { signPathsMock } = vi.hoisted(() => ({ signPathsMock: vi.fn() }))

// 진짜 모듈은 `getSupabase()`를 집는다. 그 호출만 대체하므로 SIGNED_URL_TTL_SECONDS와
// storageKeys는 훅이 실제로 쓰는 값 그대로다.
vi.mock('@/shared/api/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/storage')>()),
  signPaths: signPathsMock,
}))

// `isSupabaseConfigured`는 모듈 로드 때 import.meta.env에서 계산되고 vitest에서는
// 비어 있다 — 이것이 없으면 쿼리가 꺼지고 아래 모든 단언이 한 번도 돌지 않은 훅을
// 상대로 통과한다.
vi.mock('@/shared/api/supabase', () => ({
  isSupabaseConfigured: true,
  STORAGE_BUCKET: 'wardrobe',
  getSupabase: () => {
    throw new Error('테스트에서 실제 Supabase 클라이언트를 부르면 안 됨')
  },
}))

afterEach(() => {
  signPathsMock.mockReset()
  vi.useRealTimers()
})

function image(id: string, sortOrder: number): ItemImage {
  return {
    id,
    itemId: 'item-1',
    userId: 'user-1',
    path: `user-1/item-1/${id}.webp`,
    thumbPath: `user-1/item-1/${id}_thumb.webp`,
    sortOrder,
    width: 1280,
    height: 1280,
    createdAt: '2026-01-01T00:00:00Z',
  }
}

function renderUseItemPhotos(
  images: readonly ItemImage[] | undefined,
  // 화면을 떠났다 돌아오는 테스트만 넘긴다. 나머지는 새 클라이언트를 받아 다른
  // 테스트의 캐시를 읽지 않는다.
  client?: QueryClient,
) {
  const queryClient =
    client ??
    new QueryClient({
      // 실패가 세 번 시도 뒤가 아니라 테스트 안에서 정착해야 한다.
      defaultOptions: { queries: { retry: false } },
    })
  const rendered = renderHook((props: readonly ItemImage[] | undefined) => useItemPhotos(props), {
    initialProps: images,
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })
  return { ...rendered, queryClient }
}

describe('useItemPhotos', () => {
  it('사진이 없으면 서명 요청을 보내지 않는다', () => {
    const { result } = renderUseItemPhotos([])

    expect(result.current.slots).toEqual([])
    expect(signPathsMock).not.toHaveBeenCalled()
  })

  it('sortOrder 순으로 정렬하고 그 순서대로 URL을 짝지운다', async () => {
    // 일부러 순서를 섞고 틈을 뒀다 — 커버는 `sortOrder`가 가장 작은 것이지 0이 아니다.
    const images = [image('b', 3), image('a', 1)]
    signPathsMock.mockResolvedValue(
      new Map([
        [images[1].path, 'https://signed/a'],
        [images[1].thumbPath, 'https://signed/a-thumb'],
        [images[0].path, 'https://signed/b'],
        [images[0].thumbPath, 'https://signed/b-thumb'],
      ]),
    )

    const { result } = renderUseItemPhotos(images)
    await waitFor(() => expect(result.current.slots[0].state).toBe('ready'))

    expect(result.current.photos.map((photo) => photo.id)).toEqual(['a', 'b'])
    /**
     * 원본과 썸네일이 **같은 사진 것끼리** 묶여 있는지까지 본다.
     *
     * 훅이 사진마다 경로 둘을 펴서 한 번에 서명하고 다시 접는데, 접는 자리에서 위치로
     * 맞추면 두 번째 사진이 첫 번째의 썸네일을 자리표시자로 깐다. 화면에서는 "잠깐 다른
     * 옷이 보였다"로만 드러나고, URL만 세는 단언은 그것을 통과시킨다.
     */
    expect(result.current.slots).toEqual([
      { id: 'a', state: 'ready', url: 'https://signed/a', thumbUrl: 'https://signed/a-thumb' },
      { id: 'b', state: 'ready', url: 'https://signed/b', thumbUrl: 'https://signed/b-thumb' },
    ])
  })

  it('캐시 패치로 같은 사진이 다시 들어와도 재서명하지 않는다', async () => {
    const images = [image('a', 0)]
    signPathsMock.mockResolvedValue(new Map([[images[0].path, 'https://signed/a']]))

    const { result, rerender } = renderUseItemPhotos(images)
    await waitFor(() => expect(result.current.slots[0].state).toBe('ready'))
    const before = result.current.slots

    // 같은 배열 참조 — `{ ...entry, isFavorite }`가 남기는 것이고, 별 탭이 모든
    // `<img>`를 다시 마운트하지 않게 하는 것이다.
    rerender(images)
    expect(result.current.slots).toBe(before)

    // 내용이 같은 다른 배열 — react-query가 키를 값으로 해싱하므로 여전히 같은 캐시
    // 엔트리이고 여전히 왕복이 없다. (경로를 문자열로 잇던 것을 이것이 대체했다.)
    rerender([...images])
    expect(signPathsMock).toHaveBeenCalledTimes(1)
    expect(result.current.slots).toEqual(before)
  })

  it('로드 실패로 표시한 사진은 새 서명이 도착하면 다시 시도된다', async () => {
    const images = [image('a', 0)]
    signPathsMock.mockResolvedValue(new Map([[images[0].path, 'https://signed/a']]))

    const { result, queryClient } = renderUseItemPhotos(images)
    await waitFor(() => expect(result.current.slots[0].state).toBe('ready'))

    act(() => result.current.markUnloadable('a'))
    expect(result.current.slots[0].state).toBe('failed')

    // 재서명은 — URL이 만료에 가까워지면 `refetchOnWindowFocus`가 하는 일 — `<img>`가
    // 포기했을 때 없던 URL을 내준다. 옛 URL에 대한 판정이 그것을 살아남으면 안 된다.
    signPathsMock.mockResolvedValue(new Map([[images[0].path, 'https://signed/a-fresh']]))
    await act(async () => {
      await queryClient.refetchQueries()
    })

    // 맨 단언이 아니라 `waitFor` — refetchQueries는 쿼리가 끝날 때 resolve하고
    // 옵저버는 그 뒤에 React에 알린다. 리셋은 promise보다 한 틱 늦게 도착한다.
    await waitFor(() =>
      expect(result.current.slots[0]).toEqual({
        id: 'a',
        state: 'ready',
        url: 'https://signed/a-fresh',
        thumbUrl: null,
      }),
    )
  })

  it('같은 사진을 두 번 실패 처리해도 슬롯 참조가 바뀌지 않는다', async () => {
    const images = [image('a', 0)]
    signPathsMock.mockResolvedValue(new Map([[images[0].path, 'https://signed/a']]))

    const { result } = renderUseItemPhotos(images)
    await waitFor(() => expect(result.current.slots[0].state).toBe('ready'))

    act(() => result.current.markUnloadable('a'))
    const failed = result.current.slots

    // `<img onError>`는 리렌더마다 다시 발화할 수 있다. 매번 새 Set을 만들면
    // 매번 새 상태값이 되고, PhotoViewer의 키 핸들러가 프레임마다 붙었다
    // 떨어진다 — 스와이프 중에는 그게 매 프레임이다.
    act(() => result.current.markUnloadable('a'))
    expect(result.current.slots).toBe(failed)
  })

  it('URL이 살아 있는 동안은 다시 열어도 재서명하지 않는다', async () => {
    const images = [image('a', 0)]
    signPathsMock.mockResolvedValue(new Map([[images[0].path, 'https://signed/a']]))

    // 이 테스트만 클라이언트를 공유한다 — 상세 화면을 떠났다 다시 들어오는 것을
    // 재현하려면 캐시가 사이에 살아 있어야 한다.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    // 상세 화면을 열고 닫는다. 다시 열면 stale일 때만 재서명한다
    // (`refetchOnMount` 기본값) — 포커스 복귀도 같은 판정을 쓴다.
    const reopen = async () => {
      const { result, unmount } = renderUseItemPhotos(images, client)
      await waitFor(() => expect(result.current.slots[0].state).toBe('ready'))
      unmount()
    }

    await reopen()
    expect(signPathsMock).toHaveBeenCalledTimes(1)

    // 한 시간 뒤 — URL은 아직 세 시간 남았다. 재서명은 모든 <img src>를 바꾸고
    // 브라우저는 토큰까지 포함한 URL로 캐시하므로, 여기서 다시 서명하면 1280px
    // 원본을 통째로 다시 받는다. 목록용 staleTime 30분을 그대로 물려받으면
    // 정확히 이 지점에서 다시 받았다.
    vi.setSystemTime(Date.now() + 60 * 60 * 1000)
    await reopen()
    expect(signPathsMock).toHaveBeenCalledTimes(1)

    // 만료 한 시간 전을 넘긴 뒤 — 이제는 다시 서명해야 URL이 끊기지 않는다.
    // 그 한 시간이 재사용되는 URL의 잔여 수명 바닥값이기도 하다.
    vi.setSystemTime(Date.now() + (SIGNED_URL_TTL_SECONDS - 60 * 60) * 1000)
    await reopen()
    expect(signPathsMock).toHaveBeenCalledTimes(2)
  })

  it('서명이 실패하면 스켈레톤에 갇히지 않고 실패로 정착한다', async () => {
    const images = [image('a', 0), image('b', 1)]
    signPathsMock.mockRejectedValue(new Error('네트워크 없음'))

    const { result } = renderUseItemPhotos(images)

    // 영원한 `pending`이 아니다 — 계속 남는 스켈레톤은 새로고침으로 고쳐질 것이
    // 아니라 느린 네트워크로 읽힌다.
    await waitFor(() => expect(result.current.slots[0].state).toBe('failed'))
    expect(result.current.slots.map((slot) => slot.state)).toEqual(['failed', 'failed'])
    expect(result.current.slots.every((slot) => slot.url === null)).toBe(true)
  })
})
