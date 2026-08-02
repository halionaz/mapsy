/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ItemImage } from '@/entities/item'
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

function renderUseItemPhotos(images: readonly ItemImage[] | undefined) {
  const queryClient = new QueryClient({
    // A failure has to settle within the test rather than after three attempts,
    // and nothing here should read another test's cache.
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
  it('사진이 없으면 서명하지 않고 빈 슬롯으로 정착한다', () => {
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
