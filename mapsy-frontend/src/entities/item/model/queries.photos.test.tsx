/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { storedPhotoEntries } from './photoEntries'
import { useUpdateItem } from './queries'
import { wardrobeKeys } from './queryKeys'
import type { Item, ItemImage, WardrobeItem } from './types'

/**
 * 저장이 언제 사진을 건드려도 되는가.
 *
 * `set_item_images`는 델타가 아니라 목록 전체를 받으므로 부르는 것이 공짜인 적이 없다 —
 * 목록이 말하지 않은 사진은 전부 지운다. 그래서 필드와 사진이 두 쓰기이고, 폼이 목록이
 * 바뀌었다고 말하지 않으면 두 번째는 건너뛴다.
 *
 * 그 플래그는 여기의 비교가 아니라 폼에서 오고, 이 테스트는 그것을 주어진 것으로 받는다 —
 * 비교 자체는 `photoEntries.test.ts`가, 폼이 정직하게 알리는지는 `ItemForm.test.tsx`가 붙든다.
 */

const { setItemPhotosMock, updateItemMock } = vi.hoisted(() => ({
  setItemPhotosMock: vi.fn(),
  updateItemMock: vi.fn(),
}))

vi.mock('../api/itemApi', () => ({
  createItem: vi.fn(),
  updateItem: updateItemMock,
  setItemPhotos: setItemPhotosMock,
  setFavorite: vi.fn(),
  setStatus: vi.fn(),
  deleteItem: vi.fn(),
}))

function image(id: string, sortOrder: number): ItemImage {
  return {
    id,
    itemId: 'i1',
    userId: 'u1',
    path: `${id}.webp`,
    thumbPath: `${id}_thumb.webp`,
    sortOrder,
    width: 1280,
    height: 960,
    createdAt: '2026-08-01T00:00:00Z',
  }
}

const item: WardrobeItem = {
  id: 'i1',
  userId: 'u1',
  title: '마산 플리스',
  categoryId: 'outer.fleece',
  brand: null,
  size: null,
  fit: null,
  colors: [],
  seasons: [],
  price: null,
  purchasedAt: null,
  purchasePlace: null,
  memo: null,
  tags: [],
  status: 'owned',
  isFavorite: false,
  createdAt: '2026-08-01T00:00:00Z',
  updatedAt: '2026-08-01T00:00:00Z',
  images: [image('a', 0), image('b', 1)],
  coverUrl: 'signed://a_thumb',
}

const draft = { title: '마산 플리스 자켓', categoryId: 'outer.fleece' } as const

function renderUpdate() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(wardrobeKeys.list(), [item])

  const { result } = renderHook(() => useUpdateItem(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  return { client, result }
}

function cached(client: QueryClient): WardrobeItem {
  const entries = client.getQueryData<WardrobeItem[]>(wardrobeKeys.list())
  if (!entries?.[0]) throw new Error('캐시가 비었음')
  return entries[0]
}

describe('useUpdateItem', () => {
  it('폼이 건드리지 않았다고 하면 사진을 그대로 둔다', async () => {
    updateItemMock.mockResolvedValue({ ...item, title: draft.title } satisfies Item)
    const { client, result } = renderUpdate()

    await result.current.mutateAsync({
      item,
      draft,
      photos: storedPhotoEntries(item.images),
      photosChanged: false,
    })

    expect(setItemPhotosMock).not.toHaveBeenCalled()
    expect(cached(client).title).toBe('마산 플리스 자켓')
    // 둘 다, 있던 순서 그대로 — 건드리지 않은 목록은 캐시에서도 건드려지지 않고
    // 다시 지어진 것으로 갈아치워지지 않는다.
    expect(cached(client).images.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('순서가 바뀌면 사진을 쓰고, 돌아온 것으로 캐시를 기운다', async () => {
    const reordered = [image('b', 0), image('a', 1)]
    updateItemMock.mockResolvedValue({ ...item, title: draft.title } satisfies Item)
    setItemPhotosMock.mockResolvedValue({
      images: reordered,
      coverUrl: 'signed://b_thumb',
    })
    const { client, result } = renderUpdate()

    const entries = storedPhotoEntries(item.images)
    await result.current.mutateAsync({
      item,
      draft,
      photos: [entries[1], entries[0]],
      photosChanged: true,
    })

    expect(setItemPhotosMock).toHaveBeenCalledTimes(1)
    // 커버가 옮겨졌으니 격자의 썸네일도 함께 옮겨져야 한다 — 사진만 기우고 `coverUrl`을
    // 두고 오면 더는 커버가 아닌 사진을 보여주는 카드가 된다.
    expect(cached(client).images.map((i) => i.id)).toEqual(['b', 'a'])
    expect(cached(client).coverUrl).toBe('signed://b_thumb')
  })
})
