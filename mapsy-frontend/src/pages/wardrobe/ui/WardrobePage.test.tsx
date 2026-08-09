/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { WardrobeItem } from '@/entities/item'
import { WardrobePage } from './WardrobePage'

/**
 * Which screens offer a way to register a garment.
 *
 * The FAB is hidden on exactly one screen — the empty wardrobe — because that
 * screen carries its own 첫 옷 등록하기 and two pills to the same route is the
 * app asking twice. The condition for "that screen" has now been wrong twice in
 * a row in opposite directions, so it is held down here.
 *
 * The subtle half is that `entries` is `data ?? []`, which makes a wardrobe that
 * is still loading and one that failed to load both look empty. Hiding the FAB
 * on those took the error screen down to no route to /items/new at all — and
 * registration is the one thing that still works with the network down, because
 * it queues.
 */

const { useWardrobeMock } = vi.hoisted(() => ({ useWardrobeMock: vi.fn() }))

vi.mock('@/entities/item', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/item')>()),
  useWardrobe: useWardrobeMock,
}))

function renderWardrobe() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <WardrobePage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const registerFab = () => screen.queryByLabelText('옷 등록')

beforeEach(() => useWardrobeMock.mockReset())
afterEach(cleanup)

describe('WardrobePage — the route to registration', () => {
  it('keeps the register button while the wardrobe is still loading', () => {
    useWardrobeMock.mockReturnValue({ data: undefined, isLoading: true, error: null })
    renderWardrobe()

    expect(registerFab()).not.toBeNull()
  })

  it('keeps the register button when the wardrobe failed to load', () => {
    useWardrobeMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('offline'),
    })
    renderWardrobe()

    // Otherwise the screen is a dead end: no grid, no empty-state action, and
    // nothing in the corner either.
    expect(registerFab()).not.toBeNull()
    expect(screen.getByRole('button', { name: /다시 시도/ })).toBeDefined()
  })

  it('hands the empty wardrobe its own call to action, and only that one', () => {
    useWardrobeMock.mockReturnValue({ data: [], isLoading: false, error: null })
    renderWardrobe()

    expect(screen.getByRole('link', { name: /첫 옷 등록하기/ })).toBeDefined()
    expect(registerFab()).toBeNull()
  })

  it('shows the register button once there is something in the wardrobe', () => {
    useWardrobeMock.mockReturnValue({ data: [item()], isLoading: false, error: null })
    renderWardrobe()

    expect(registerFab()).not.toBeNull()
  })
})

/** The few fields this screen actually reads. */
function item(): WardrobeItem {
  return {
    id: 'i1',
    userId: 'u1',
    title: '마산 플리스',
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
