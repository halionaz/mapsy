/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ItemImage, WardrobeItem } from '@/entities/item'
import { ItemEditPage } from './ItemEditPage'

/**
 * 답을 폼에서 쓰기로 나르는 한 줄.
 *
 * 사진이 건드려졌는지는 `ItemForm`이 알아내고 `useUpdateItem`이 그것을 존중한다. 둘 다
 * 각자의 자리에서 붙들려 있다. 어느 쪽도 볼 수 없는 것이 이 화면이 그 플래그를 넘기는
 * 일이고, 타입 검사기는 *무언가* 넘어가기만 하면 되므로 하드코딩된 `true`도 컴파일된다 —
 * 그리고 플래그가 막으려던 결함을 조용히 되살린다.
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

// 그대로 두면 Supabase를 집는 서명 훅. 피커는 그릴 URL만 있으면 되고, 이 테스트는
// 픽셀을 보지 않는다.
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
    slots: item.images.map((entry) => ({
      id: entry.id,
      state: 'ready',
      url: `signed://${entry.id}`,
    })),
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
  it('텍스트만 고친 편집은 사진을 건드리지 않았다고 저장에 알린다', () => {
    renderPage()

    fireEvent.change(screen.getByLabelText(/이름/), { target: { value: '마산 플리스 자켓' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    expect(mutateMock).toHaveBeenCalledWith(
      expect.objectContaining({ photosChanged: false }),
      expect.anything(),
    )
  })

  it('재정렬됐을 때는 그렇다고 알린다', () => {
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
