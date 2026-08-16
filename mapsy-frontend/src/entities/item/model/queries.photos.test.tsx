/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { storedPhotoEntries } from './photoEntries'
import { useUpdateItem } from './queries'
import { wardrobeKeys } from './queryKeys'
import type { Item, ItemImage, WardrobeItem } from './types'

/**
 * When a save is allowed to touch the photos.
 *
 * `set_item_images` is handed the whole list rather than a delta, so calling it
 * is never free: it deletes every photo of the item that the list does not
 * mention. So the fields and the photos are two separate writes and the second
 * one is skipped unless the form says its list changed.
 *
 * The flag comes from the form rather than from a comparison here, and these
 * tests take it as given — `photoEntries.test.ts` holds down the comparison
 * itself, and `ItemForm.test.tsx` that the form reports it honestly.
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
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  return { client, result }
}

function cached(client: QueryClient): WardrobeItem {
  const entries = client.getQueryData<WardrobeItem[]>(wardrobeKeys.list())
  if (!entries?.[0]) throw new Error('캐시가 비었음')
  return entries[0]
}

describe('useUpdateItem', () => {
  it('leaves the photos alone when the form says it did not touch them', async () => {
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
    // Still both, still in the order they were: an untouched list is untouched
    // in the cache too, not replaced by a rebuilt one.
    expect(cached(client).images.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('writes the photos when the order changed, and patches what came back', async () => {
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
    // The cover moved, so the grid's thumbnail has to move with it — patching
    // the images and leaving `coverUrl` behind is a card showing the photo that
    // is no longer the cover.
    expect(cached(client).images.map((i) => i.id)).toEqual(['b', 'a'])
    expect(cached(client).coverUrl).toBe('signed://b_thumb')
  })
})
