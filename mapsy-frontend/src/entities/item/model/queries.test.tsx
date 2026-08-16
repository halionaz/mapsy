/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useDeleteItemRow } from './queries'
import { wardrobeKeys } from './queryKeys'
import type { WardrobeItem } from './types'

/**
 * 삭제가 옷장 캐시에서 그 옷을 걷어내는지.
 *
 * 착용 기록 쪽 절반은 `features/item-delete`의 테스트가 본다 — 이 엔티티의 캐시 키는
 * 자기 것이고 lint 규칙이 그것을 밖으로 내보내지 않는다. 둘이 합쳐 하나가 덮을 것을 덮는다.
 */

vi.mock('../api/itemApi', () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
  setItemPhotos: vi.fn(),
  setFavorite: vi.fn(),
  setStatus: vi.fn(),
  deleteItem: vi.fn().mockResolvedValue(undefined),
}))

function garment(id: string): WardrobeItem {
  return {
    id,
    userId: 'u1',
    title: id,
    categoryId: 'top.knit',
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
    images: [],
    coverUrl: null,
  }
}

describe('useDeleteItemRow', () => {
  it('지운 옷을 옷장 캐시에서 걷어낸다', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    client.setQueryData(wardrobeKeys.list(), [garment('a'), garment('b')])

    const { result } = renderHook(() => useDeleteItemRow(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    await result.current.mutateAsync({ id: 'a', userId: 'u1' })

    expect(client.getQueryData<WardrobeItem[]>(wardrobeKeys.list())?.map((i) => i.id)).toEqual([
      'b',
    ])
  })
})
