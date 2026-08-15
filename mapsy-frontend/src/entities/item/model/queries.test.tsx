/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useDeleteItem } from './queries'
import { wardrobeKeys } from './queryKeys'
import type { WardrobeItem } from './types'

/**
 * Deleting a garment has to empty two caches, not one.
 *
 * The wear half is asserted from the other side of the boundary —
 * `entities/wear/model/queries.test.tsx` proves `dropItemWears` removes the
 * right rows, and this proves the delete actually reaches for it with the right
 * client and id. Split because the entity's cache keys are private to it and a
 * lint rule keeps them that way; the pair covers what one test would have.
 */

const { dropItemWearsMock } = vi.hoisted(() => ({
  dropItemWearsMock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/entities/wear', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/wear')>()),
  dropItemWears: dropItemWearsMock,
}))

vi.mock('../api/itemApi', () => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
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

describe('useDeleteItem', () => {
  it('patches the wardrobe and clears the garment out of the wear log', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    client.setQueryData(wardrobeKeys.list(), [garment('a'), garment('b')])

    const { result } = renderHook(() => useDeleteItem(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    await result.current.mutateAsync({ id: 'a', userId: 'u1' })

    expect(client.getQueryData<WardrobeItem[]>(wardrobeKeys.list())?.map((i) => i.id)).toEqual([
      'b',
    ])
    // The same client, not just any — a call against a second QueryClient would
    // patch an entry no screen is reading.
    expect(dropItemWearsMock).toHaveBeenCalledWith(client, 'a')
  })
})
