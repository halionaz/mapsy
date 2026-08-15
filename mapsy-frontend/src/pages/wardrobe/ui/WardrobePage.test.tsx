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
  return {
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  }
}

vi.mock('@/entities/item', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/item')>()),
  useWardrobe: useWardrobeMock,
}))

/**
 * `rerender` takes no argument and redraws the same screen.
 *
 * It is how a test moves the wardrobe underneath a screen that already has
 * state in it — the mock returns new rows, this puts them on the existing
 * component rather than mounting a second one whose filters start empty.
 * A fresh element each time, because React is allowed to skip a subtree whose
 * element is referentially the one it already drew.
 */
function renderWardrobe() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const tree = () => (
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <WardrobePage />
      </MemoryRouter>
    </QueryClientProvider>
  )
  const result = render(tree())
  return { ...result, rerender: () => result.rerender(tree()) }
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

  /**
   * A failed refetch must not throw away the wardrobe that is already here.
   *
   * react-query keeps `data` when a background refetch fails — `error` is set
   * alongside it, not instead of it. The screen branched on `error` before it
   * looked at `data`, so every row could be in memory and the grid would still
   * be replaced by 옷장을 불러오지 못했어요.
   *
   * The path is ordinary rather than exotic: `refetchOnWindowFocus` is on
   * deliberately (AppProviders), so browsing a wardrobe, backgrounding the app
   * and coming back somewhere without signal is enough to lose the screen.
   */
  it('keeps showing the wardrobe it already has when a refetch fails', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()], error: new Error('offline') }))
    renderWardrobe()

    expect(screen.getByText('마산 플리스')).toBeDefined()
    expect(screen.queryByText('옷장을 불러오지 못했어요')).toBeNull()
  })

  it('says so, without taking the wardrobe away, when a refetch fails', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()], error: new Error('offline') }))
    renderWardrobe()

    expect(screen.getByRole('button', { name: /다시 시도/ })).toBeDefined()
    expect(registerFab()).not.toBeNull()
  })

  /**
   * An empty wardrobe is an answer, not a missing one.
   *
   * `data: []` means the fetch succeeded and there are no garments. A later
   * refetch failing does not undo that, so the screen still owes the user the
   * onboarding copy rather than a load failure.
   */
  it('leaves an empty wardrobe empty when its refetch fails', () => {
    useWardrobeMock.mockReturnValue(query({ data: [], error: new Error('offline') }))
    renderWardrobe()

    expect(screen.getByText('아직 등록한 옷이 없어요')).toBeDefined()
    expect(screen.queryByText('옷장을 불러오지 못했어요')).toBeNull()
  })

  it('says only once that the list may be out of date', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()], error: new Error('offline') }))
    const { container } = renderWardrobe()

    const announcing = [...container.querySelectorAll('[role="status"], [role="alert"]')].filter(
      (node) => node.textContent?.includes('불러오지 못했'),
    )

    expect(announcing).toHaveLength(1)
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

/**
 * The category rail offers what the wardrobe holds, and the grid is split by it.
 *
 * Both halves of one rule — a category with nothing in it is not a place the
 * user can go — so a chip that matches nothing and a heading over no cards are
 * the same defect seen from two sides.
 */
describe('WardrobePage — categories', () => {
  const chip = (label: string) => screen.queryByRole('button', { name: label })

  it('offers no chip for a category this wardrobe has nothing in', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item(), item({ id: 'i2', categoryId: 'shoes.boots' })] }))
    renderWardrobe()

    expect(chip('상의')).not.toBeNull()
    expect(chip('신발')).not.toBeNull()
    // The wardrobe has no 원피스/셋업, no 가방, no 액세서리. All eight groups were
    // drawn regardless, so the rail was mostly chips that could only empty the
    // screen.
    expect(chip('원피스/셋업')).toBeNull()
    expect(chip('가방')).toBeNull()
  })

  /**
   * A lit chip must not be able to leave while it is still filtering.
   *
   * Disposing of the last pair of shoes with 신발 selected takes the group out of
   * the wardrobe, but `filters.groupIds` still holds it — and the summary row
   * deliberately carries no 대분류 pill, so if the chip goes too there is nothing
   * left on screen that can turn the filter off.
   */
  it('keeps the selected chip after its last garment leaves the wardrobe', () => {
    const shoes = item({ id: 'i2', categoryId: 'shoes.boots' })
    useWardrobeMock.mockReturnValue(query({ data: [item(), shoes] }))
    const { rerender } = renderWardrobe()

    fireEvent.click(screen.getByRole('button', { name: '신발' }))
    useWardrobeMock.mockReturnValue(query({ data: [item(), { ...shoes, status: 'disposed' }] }))
    rerender()

    expect(chip('신발')).not.toBeNull()
  })

  it('draws no rail at all when everything is in one category', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item(), item({ id: 'i2', title: '흰 티' })] }))
    renderWardrobe()

    // 전체 and 상의 select the same garments here, so the row is two controls
    // that cannot disagree.
    expect(chip('전체')).toBeNull()
    expect(chip('상의')).toBeNull()
    expect(screen.getByText('흰 티')).toBeDefined()
  })

  it('splits the grid into a section per category, in table order', () => {
    useWardrobeMock.mockReturnValue(
      query({
        data: [
          item({ id: 'i1', categoryId: 'shoes.boots' }),
          item({ id: 'i2', categoryId: 'top.knit' }),
        ],
      }),
    )
    renderWardrobe()

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent),
    ).toEqual(['상의1', '신발1'])
  })

  /**
   * With a chip lit there is exactly one section, and heading it with the name
   * of the chip that produced it says the same thing twice.
   */
  it('drops the headings once a category is chosen', () => {
    useWardrobeMock.mockReturnValue(
      query({
        data: [
          item({ id: 'i1', categoryId: 'shoes.boots' }),
          item({ id: 'i2', categoryId: 'top.knit' }),
        ],
      }),
    )
    renderWardrobe()

    fireEvent.click(screen.getByRole('button', { name: '상의' }))

    expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
    expect(screen.getByText('마산 플리스')).toBeDefined()
  })
})

/** The few fields this screen actually reads. */
function item(overrides: Partial<WardrobeItem> = {}): WardrobeItem {
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
    ...overrides,
  }
}
