/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ItemImage, WardrobeItem } from '@/entities/item'
import { ItemEditPage } from './ItemEditPage'

/**
 * The one line that carries the answer from the form to the write.
 *
 * `ItemForm` works out whether the photos were touched and `useUpdateItem`
 * honours it; both are held down where they live. What neither can see is this
 * screen handing the flag over — and the type checker only insists that
 * *something* is passed, so a hardcoded `true` compiles and quietly restores the
 * defect the flag exists to prevent: a save that never touched the photos
 * rewriting the list, and deleting whatever another device added meanwhile.
 */

const { useWardrobeMock, mutateMock, useItemPhotosMock } = vi.hoisted(() => ({
  useWardrobeMock: vi.fn(),
  mutateMock: vi.fn(),
  useItemPhotosMock: vi.fn(),
}))

vi.mock('@/entities/item', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/item')>()),
  useWardrobe: useWardrobeMock,
  useUpdateItem: () => ({ mutate: mutateMock, isPending: false, error: null }),
}))

// The signing hook, which would otherwise reach for Supabase. The picker only
// needs URLs to draw with, and these tests never look at the pixels.
vi.mock('@/features/item-photos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/item-photos')>()),
  useItemPhotos: useItemPhotosMock,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

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
  coverUrl: 'signed://a',
}

function renderPage() {
  useWardrobeMock.mockReturnValue({ data: [item], isLoading: false })
  useItemPhotosMock.mockReturnValue({
    photos: item.images,
    slots: item.images.map((entry) => ({ id: entry.id, state: 'ready', url: `signed://${entry.id}` })),
    markUnloadable: vi.fn(),
  })

  return render(
    <MemoryRouter initialEntries={['/items/i1/edit']}>
      <Routes>
        <Route path="/items/:id/edit" element={<ItemEditPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ItemEditPage', () => {
  it('tells the save that a text-only edit left the photos alone', () => {
    renderPage()

    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '마산 플리스 자켓' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ photosChanged: false }),
      expect.anything(),
    )
  })

  it('tells it when they were rearranged', () => {
    renderPage()

    const tile = screen.getByLabelText('사진 2')
    fireEvent.keyDown(tile, { key: ' ' })
    fireEvent.keyDown(tile, { key: 'ArrowLeft' })
    fireEvent.keyDown(tile, { key: ' ' })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ photosChanged: true }),
      expect.anything(),
    )
  })
})
