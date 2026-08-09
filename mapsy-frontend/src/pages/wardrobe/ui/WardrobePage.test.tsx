/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

/** The shape `useWardrobe` returns, with only what this screen reads. */
function query(overrides: Record<string, unknown>) {
  return { data: undefined, isLoading: false, isFetching: false, error: null, refetch: vi.fn(), ...overrides }
}

vi.mock('@/entities/item', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/item')>()),
  useWardrobe: useWardrobeMock,
}))

function renderWardrobe() {
  return render(
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
    useWardrobeMock.mockReturnValue(query({ isLoading: true, isFetching: true }))
    renderWardrobe()

    expect(registerFab()).not.toBeNull()
  })

  it('keeps the register button when the wardrobe failed to load', () => {
    useWardrobeMock.mockReturnValue(query({ error: new Error('offline') }))
    renderWardrobe()

    // Otherwise the screen is a dead end: no grid, no empty-state action, and
    // nothing in the corner either.
    expect(registerFab()).not.toBeNull()
  })

  /**
   * The retry has to be wired, not merely present.
   *
   * Asserting the button exists is the same mistake as asserting a destructive
   * button carries `bg_danger` without checking that the accent fill is gone: it
   * passes against a button that does nothing.
   */
  it('actually refetches when the retry is pressed', () => {
    const refetch = vi.fn()
    useWardrobeMock.mockReturnValue(query({ error: new Error('offline'), refetch }))
    renderWardrobe()

    fireEvent.click(screen.getByRole('button', { name: /다시 시도/ }))

    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('will not queue a second refetch while one is in flight', () => {
    const refetch = vi.fn()
    useWardrobeMock.mockReturnValue(
      query({ error: new Error('offline'), isFetching: true, refetch }),
    )
    renderWardrobe()

    fireEvent.click(screen.getByRole('button', { name: /다시 시도/ }))

    expect(refetch).not.toHaveBeenCalled()
  })

  it('hands the empty wardrobe its own call to action, and only that one', () => {
    useWardrobeMock.mockReturnValue(query({ data: [] }))
    renderWardrobe()

    expect(screen.getByRole('link', { name: /첫 옷 등록하기/ })).toBeDefined()
    expect(registerFab()).toBeNull()
  })

  /**
   * The wash is `position: absolute` and the page column is what it is measured
   * against. `isolation: isolate` opens a stacking context but establishes no
   * containing block, and swapping one property for the other once already sent
   * the wash to the viewport — an orange band across the full width of any
   * window wider than the 480px column.
   */
  it('keeps the screen column a containing block as well as a stacking context', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    const { container } = renderWardrobe()
    const column = container.firstElementChild

    expect(column?.className).toContain('pos_relative')
    expect(column?.className).toContain('isolation_isolate')
  })

  it('shows the register button once there is something in the wardrobe', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
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
