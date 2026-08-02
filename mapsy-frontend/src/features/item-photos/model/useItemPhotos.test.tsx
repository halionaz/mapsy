/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ItemImage } from '@/entities/item'
import { SIGNED_URL_TTL_SECONDS } from '@/shared/api/storage'
import { useItemPhotos } from './useItemPhotos'

/**
 * The one piece of logic this feature rewrote rather than moved.
 *
 * `photoSlots` says in its own header that its three-line rule has been got
 * wrong twice, in both directions — and this hook is what now produces the URLs
 * it was got wrong about. What is held down here is not the rendering but the
 * four facts the screen quietly depends on: an item with no photos settles
 * rather than waiting forever, a cache patch does not re-sign, a fresh signing
 * forgives a photo that would not load, and a failure settles as failure.
 *
 * The identity assertions matter as much as the value ones. Swiping in the
 * viewer re-renders the screen on every frame, and the viewer rebuilds its key
 * handler whenever `slots` changes identity.
 */

const { signPathsMock } = vi.hoisted(() => ({ signPathsMock: vi.fn() }))

// The real module reaches for `getSupabase()`; only the call is replaced, so
// SIGNED_URL_TTL_SECONDS and storageKeys stay the values the hook ships with.
vi.mock('@/shared/api/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/storage')>()),
  signPaths: signPathsMock,
}))

// `isSupabaseConfigured` is computed at module load from import.meta.env, which
// is empty under vitest — without this the query is disabled and every
// assertion below would pass against a hook that never ran.
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
  // Passed in only by the test that leaves the screen and comes back; every
  // other test gets a fresh client so nothing reads another test's cache.
  client?: QueryClient,
) {
  const queryClient =
    client ??
    new QueryClient({
      // A failure has to settle within the test rather than after three
      // attempts.
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
    // Deliberately out of order, and with a gap — the cover is the lowest
    // sortOrder, not literally 0.
    const images = [image('b', 3), image('a', 1)]
    signPathsMock.mockResolvedValue(
      new Map([
        [images[1].path, 'https://signed/a'],
        [images[0].path, 'https://signed/b'],
      ]),
    )

    const { result } = renderUseItemPhotos(images)
    await waitFor(() => expect(result.current.slots[0].state).toBe('ready'))

    expect(result.current.photos.map((photo) => photo.id)).toEqual(['a', 'b'])
    expect(result.current.slots).toEqual([
      { id: 'a', state: 'ready', url: 'https://signed/a' },
      { id: 'b', state: 'ready', url: 'https://signed/b' },
    ])
  })

  it('캐시 패치로 같은 사진이 다시 들어와도 재서명하지 않는다', async () => {
    const images = [image('a', 0)]
    signPathsMock.mockResolvedValue(new Map([[images[0].path, 'https://signed/a']]))

    const { result, rerender } = renderUseItemPhotos(images)
    await waitFor(() => expect(result.current.slots[0].state).toBe('ready'))
    const before = result.current.slots

    // Same array reference — what `{ ...entry, isFavorite }` leaves behind, and
    // what keeps a star tap from remounting every <img>.
    rerender(images)
    expect(result.current.slots).toBe(before)

    // A different array with the same contents: react-query hashes the key by
    // value, so this is still the same cache entry and still no round trip.
    // (This is what replaced joining the paths into a string.)
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

    // A re-sign — what `refetchOnWindowFocus` does once the URLs are near
    // expiry — hands out a URL that did not exist when the <img> gave up, so
    // the verdict against the old one must not survive it.
    signPathsMock.mockResolvedValue(new Map([[images[0].path, 'https://signed/a-fresh']]))
    await act(async () => {
      await queryClient.refetchQueries()
    })

    // `waitFor`, not a bare assertion: refetchQueries resolves when the query
    // does, and the observer notifies React after that — the reset lands a tick
    // later than the promise.
    await waitFor(() =>
      expect(result.current.slots[0]).toEqual({
        id: 'a',
        state: 'ready',
        url: 'https://signed/a-fresh',
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

    // 만료 30분 전을 넘긴 뒤 — 이제는 다시 서명해야 URL이 끊기지 않는다.
    vi.setSystemTime(Date.now() + (SIGNED_URL_TTL_SECONDS - 60 * 60) * 1000)
    await reopen()
    expect(signPathsMock).toHaveBeenCalledTimes(2)
  })

  it('서명이 실패하면 스켈레톤에 갇히지 않고 실패로 정착한다', async () => {
    const images = [image('a', 0), image('b', 1)]
    signPathsMock.mockRejectedValue(new Error('네트워크 없음'))

    const { result } = renderUseItemPhotos(images)

    // Not `pending` forever: a permanent skeleton reads as a slow network
    // rather than as something a reload would fix.
    await waitFor(() => expect(result.current.slots[0].state).toBe('failed'))
    expect(result.current.slots.map((slot) => slot.state)).toEqual(['failed', 'failed'])
    expect(result.current.slots.every((slot) => slot.url === null)).toBe(true)
  })
})
