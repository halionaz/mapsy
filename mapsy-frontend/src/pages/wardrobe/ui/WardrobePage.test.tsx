/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PendingUpload, WardrobeItem } from '@/entities/item'
import { closeWearDraft, openWearDraft } from '@/features/wear-log'
import { toaster } from '@/shared/ui/toast'
import { todayLocal } from '@/shared/lib/calendarDay'
import { WardrobePage } from './WardrobePage'

/** The signed-in user these tests run as. Matches the item fixture's `userId`. */
const OWNER = 'u1'

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

const {
  useWardrobeMock,
  usePendingUploadsMock,
  useWearsMock,
  submitWearsMock,
  useCurrentUserIdMock,
} = vi.hoisted(() => ({
  useWardrobeMock: vi.fn(),
  usePendingUploadsMock: vi.fn(),
  useWearsMock: vi.fn(),
  submitWearsMock: vi.fn(),
  useCurrentUserIdMock: vi.fn(),
}))

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

/**
 * `usePendingUploads` is mocked as well as `useWardrobe`.
 *
 * The real one is a module-level store that starts empty, so every test saw
 * zero uploads in flight and the branch that draws them was never entered —
 * deleting it outright left all 189 tests green.
 */
vi.mock('@/entities/item', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/item')>()),
  useWardrobe: useWardrobeMock,
  usePendingUploads: usePendingUploadsMock,
}))

/**
 * The wear log's two hooks, and nothing else from the entity.
 *
 * `attachWears` and `itemIdsWornOn` stay real: they are what turns the rows
 * below into what the cards and the seeded selection actually show, and mocking
 * them would leave these tests asserting against a fixture instead of against
 * the merge.
 */
vi.mock('@/entities/wear', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/entities/wear')>()),
  useWears: useWearsMock,
  useSetWears: () => ({ mutate: submitWearsMock, isPending: false }),
}))

/**
 * The signed-in user, because a draft now carries whose it is.
 *
 * There is no Supabase in a unit run, so the real hook answers `null` — which
 * the screen reads as "cannot record" and would have taken the whole feature off
 * every screen below.
 */
vi.mock('@/features/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/auth')>()),
  useCurrentUserId: useCurrentUserIdMock,
}))

const uploading: PendingUpload = {
  tempId: 't1',
  draft: { title: '올라가는 중', categoryId: 'shoes.boots' },
  photos: [],
  userId: 'u1',
  state: 'uploading',
}

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

beforeEach(() => {
  useWardrobeMock.mockReset()
  usePendingUploadsMock.mockReset()
  usePendingUploadsMock.mockReturnValue([])
  useWearsMock.mockReset()
  // The default is "answered, nothing recorded". `undefined` — the state before
  // the log has replied — is a case some tests below ask for on purpose.
  useWearsMock.mockReturnValue({ data: [] })
  submitWearsMock.mockReset()
  useCurrentUserIdMock.mockReset()
  useCurrentUserIdMock.mockReturnValue(OWNER)
  // A module-level store that outlives a render, so it has to be put back
  // between tests or a selection left open leaks into the next one.
  closeWearDraft()
})
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
    useWardrobeMock.mockReturnValue(
      query({ data: [item(), item({ id: 'i2', categoryId: 'shoes.boots' })] }),
    )
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
   * the wardrobe while `filters.groupIds` still holds it. The chip is the only
   * thing on the page naming the category being looked at — the summary row
   * carries no 대분류 pill — so without it the screen empties with nothing
   * saying why.
   *
   * Not because there is no way to turn it off: that state is `noMatches`, and
   * its 필터 모두 해제 clears `groupIds`. Measured — the button is on screen here.
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

    expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)).toEqual([
      '상의1',
      '신발1',
    ])
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

  /**
   * The sort control sits above every heading, and with headings on it can no
   * longer promise the order it names.
   *
   * Sections run in the category table's order, so 최근 등록순 holds only inside
   * one: a 가방 registered today draws below three garments from January.
   * Nothing can make grouping and a global order both true, so the label carries
   * the grouping rather than leaving it out.
   */
  it('says the screen is grouped, wherever it also names a sort', () => {
    useWardrobeMock.mockReturnValue(
      query({
        data: [
          item({ id: 'i1', categoryId: 'top.knit' }),
          item({ id: 'i2', categoryId: 'bag.tote', title: '방금 산 가방' }),
        ],
      }),
    )
    renderWardrobe()

    expect(screen.getByRole('button', { name: /갈래별 · 최근 등록순/ })).toBeDefined()
  })

  it('names the sort alone once there is nothing to group', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    expect(screen.getByRole('button', { name: '최근 등록순' })).toBeDefined()
  })
})

/**
 * Registrations still uploading are drawn, and drawn outside the sections.
 *
 * None of this was covered: `usePendingUploads` is a real module-level store
 * that every test left empty, so deleting the branch that renders these cards
 * kept all 189 tests green. The comment above that branch is a promise — an
 * upload filed under a category heading is one the user cannot find, and the
 * card is the only route to its retry button.
 */
describe('WardrobePage — uploads in flight', () => {
  it('pins the upload above the wardrobe, out of every section', () => {
    usePendingUploadsMock.mockReturnValue([uploading])
    useWardrobeMock.mockReturnValue(
      query({
        data: [
          item({ id: 'i1', categoryId: 'top.knit' }),
          item({ id: 'i2', categoryId: 'bag.tote' }),
        ],
      }),
    )
    const { container } = renderWardrobe()

    const card = screen.getByText('올라가는 중')
    expect(card.closest('section')).toBeNull()
    // Ahead of the headings, not merely present somewhere on the page.
    const first = container.querySelector('main ul, main h2')
    expect(first?.contains(card)).toBe(true)
  })

  it('leaves no empty list behind when the upload is all there is', () => {
    usePendingUploadsMock.mockReturnValue([uploading])
    useWardrobeMock.mockReturnValue(query({ data: [] }))
    const { container } = renderWardrobe()

    // `visible` is empty here while the wardrobe is not, and a second grid fed
    // from it drew a childless <ul> — one more "list, 0 items" for a screen
    // reader to walk into.
    expect([...container.querySelectorAll('ul')].map((list) => list.children.length)).toEqual([1])
  })
})

/**
 * 오늘 입은 옷 — the button, the mode it opens, and what it submits.
 *
 * The load-bearing assertion is the first one. A submit replaces a whole day, so
 * a selection seeded before the wear log has answered would send an empty set
 * over records that are really there — the feature deleting its own data on a
 * slow connection. Everything else here is behaviour; that one is a guard.
 */
describe('WardrobePage — 착용 기록', () => {
  const today = todayLocal()

  /** `8.15` from `2026-08-15`, computed without the formatter under test. */
  const monthDay = (day: string) => {
    const [, month, date] = day.split('-')
    return `${Number(month)}.${Number(date)}`
  }

  // Both resting labels — the invitation and the "already recorded" one. They
  // are the same button, and a test that only knew one of them silently found
  // nothing the moment a day had anything in it.
  const wearButton = () => screen.queryByRole('button', { name: /입은 옷 기록하기|기록 고치기/ })
  const cards = () => screen.queryAllByRole('button', { name: /마산 플리스|흰 티/ })
  // The date is a label rather than a control now, so it is found by its text.
  const dateLabel = () => screen.queryByText(/^\d+\.\d+ \(오늘\)$/)

  it('offers nothing to press until the wear log has answered', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    useWearsMock.mockReturnValue({ data: undefined })
    renderWardrobe()

    expect(wearButton()).toBeNull()
    // And the cards are still links, so a tap goes to the garment rather than
    // into a selection that has nothing to seed itself from.
    expect(screen.getByRole('link', { name: /마산 플리스/ })).toBeDefined()
  })

  it('invites a recording when the day is empty', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    expect(wearButton()).not.toBeNull()
  })

  /**
   * Today is the only day this writes.
   *
   * 어제 was the default for a while and is where this is going again, but that
   * needs a date picker rather than a two-value toggle — the control is gone
   * until then, and the day is an invariant instead of a choice.
   */
  it('opens on today, with today’s garments already ticked', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item(), item({ id: 'i2', title: '흰 티' })] }))
    useWearsMock.mockReturnValue({
      data: [
        { itemId: 'i1', wornOn: today },
        { itemId: 'i2', wornOn: '2020-01-01' },
      ],
    })
    renderWardrobe()

    fireEvent.click(wearButton()!)

    expect(dateLabel()?.textContent).toBe(`${monthDay(today)} (오늘)`)
    expect(cards().map((card) => card.getAttribute('aria-pressed'))).toEqual(['true', 'false'])
  })

  it('고르는 중인 날짜가 접근 가능한 이름에 들어간다', () => {
    // The date is a `<p>` with no role and no tab stop, so the group's name is
    // the only place it can be heard. Printing it and then not saying it takes
    // away the very thing it was printed for — checking which day a screen left
    // open since before midnight is about to write.
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    fireEvent.click(wearButton()!)

    expect(
      screen.getByRole('group', { name: `${monthDay(today)} (오늘) 입은 옷 고르기` }),
    ).toBeDefined()
  })

  it('the date is not pressable', () => {
    // A pill that looks like a control and answers nothing is worse than a
    // plain one; there is nothing to switch to until the picker exists.
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    fireEvent.click(wearButton()!)

    expect(dateLabel()).not.toBeNull()
    expect(screen.queryByRole('button', { name: /오늘\)/ })).toBeNull()
    expect(dateLabel()?.closest('button')).toBeNull()
  })

  it('says what the day already holds instead of inviting again', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item(), item({ id: 'i2', title: '흰 티' })] }))
    useWearsMock.mockReturnValue({
      data: [
        { itemId: 'i1', wornOn: today },
        { itemId: 'i2', wornOn: today },
      ],
    })
    renderWardrobe()

    // Not a disappearance: adding a jacket to a day's record after the fact is
    // the ordinary shape of this, so the button stays and carries the count.
    expect(screen.getByRole('button', { name: /오늘 2벌 기록 고치기/ })).toBeDefined()
  })

  it('replaces the register button with the date, submit and cancel', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    fireEvent.click(wearButton()!)

    // Registering a garment is not what the mode is for, and three pills plus a
    // fourth do not fit across a phone.
    expect(registerFab()).toBeNull()
    expect(dateLabel()).not.toBeNull()
    expect(screen.getByRole('button', { name: '고르기 취소' })).toBeDefined()
  })

  it('submits the picked garments against today', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item(), item({ id: 'i2', title: '흰 티' })] }))
    renderWardrobe()

    fireEvent.click(wearButton()!)
    fireEvent.click(screen.getByRole('button', { name: /흰 티/ }))
    fireEvent.click(screen.getByRole('button', { name: '1벌 기록' }))

    expect(submitWearsMock).toHaveBeenCalledTimes(1)
    expect(submitWearsMock.mock.calls[0][0]).toEqual({ wornOn: today, itemIds: ['i2'] })
  })

  /**
   * With nothing picked the submit button is disabled, so cancel is the only way
   * out of the mode — which is why it is never the control that gives up its
   * width.
   */
  it('leaves the mode on cancel, with the cards back to links', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    fireEvent.click(wearButton()!)
    fireEvent.click(screen.getByRole('button', { name: '고르기 취소' }))

    expect(screen.getByRole('link', { name: /마산 플리스/ })).toBeDefined()
    expect(registerFab()).not.toBeNull()
    expect(submitWearsMock).not.toHaveBeenCalled()
  })

  it('will not submit an empty set over a day that was already empty', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    renderWardrobe()

    fireEvent.click(wearButton()!)

    // Clearing a day that holds something is a real edit and stays pressable;
    // this one would write nothing over nothing.
    expect(screen.getByRole('button', { name: '옷을 골라주세요' }).hasAttribute('disabled')).toBe(
      true,
    )
  })

  it('offers to clear a day that does hold something', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item()] }))
    useWearsMock.mockReturnValue({ data: [{ itemId: 'i1', wornOn: today }] })
    renderWardrobe()

    fireEvent.click(screen.getByRole('button', { name: /오늘 1벌 기록 고치기/ }))
    fireEvent.click(screen.getByRole('button', { name: /마산 플리스/ }))
    fireEvent.click(screen.getByRole('button', { name: '기록 지우기' }))

    expect(submitWearsMock.mock.calls[0][0]).toEqual({ wornOn: today, itemIds: [] })
  })

  it('draws when a garment was last worn, and nothing at all when it never was', () => {
    useWardrobeMock.mockReturnValue(query({ data: [item(), item({ id: 'i2', title: '흰 티' })] }))
    useWearsMock.mockReturnValue({ data: [{ itemId: 'i1', wornOn: today }] })
    renderWardrobe()

    // For the first weeks after this ships every card would otherwise carry the
    // same 기록 없음, which is a caption rather than information.
    expect(screen.getAllByText('오늘').length).toBeGreaterThan(0)
    expect(screen.queryByText('기록 없음')).toBeNull()
  })

  /**
   * The delete this tab cannot see.
   *
   * `dropItemWears` and `knownIds` between them cover every garment removed
   * here; neither can reach one removed on another device, which stays in this
   * tab's `data` and rides along on the submit. The database rejects it, and
   * because `set_item_wears` is one transaction the whole day fails.
   *
   * What makes that worth a branch is that nothing else recovers from it:
   * `staleTime` is 30 minutes, focus refetch respects it, and this mutation
   * invalidates nothing — so the same press fails identically for half an hour.
   */
  describe('다른 기기에서 지워진 옷', () => {
    const fkError = {
      message: 'violates foreign key constraint "item_wears_item_fk"',
      code: '23503',
    }

    // Split, because the two halves cannot share an `act`: entering the mode
    // is what turns the card into a button, and a batched block would still be
    // looking at a link when it goes to tick one.
    function pickOne() {
      fireEvent.click(wearButton()!)
      fireEvent.click(screen.getByRole('button', { name: /마산 플리스/ }))
    }

    function submit() {
      fireEvent.click(screen.getByRole('button', { name: '1벌 기록' }))
    }

    function pickOneAndSubmit() {
      pickOne()
      submit()
    }

    it('옷장을 다시 불러오고, 고르던 것은 그대로 둔다', () => {
      const refetch = vi.fn().mockResolvedValue({ isError: false })
      submitWearsMock.mockImplementation((_vars, options) => options?.onError?.(fkError))
      useWardrobeMock.mockReturnValue(query({ data: [item()], refetch }))
      renderWardrobe()

      pickOneAndSubmit()

      expect(refetch).toHaveBeenCalledTimes(1)
      // The mode closes on success and only on success — a failure has to leave
      // the picks where they are.
      expect(dateLabel()).not.toBeNull()
    })

    /**
     * The message waits for the refetch, and that is the whole of the fix.
     *
     * The first version fired `void refetch()` and announced 다시 불러왔으니 한
     * 번 더 눌러주세요 in the same tick — a completed-sounding instruction that,
     * followed immediately, re-sent the identical set, because `knownIds` comes
     * from `data` and `data` had not moved yet.
     *
     * Asserted on `toaster.create` rather than on the payload of a second press:
     * the payload version passes against the broken code too, since a test can
     * hand the refetch a synchronous mock and then redraw by hand. What actually
     * changed is *when* the sentence appears, so that is what is measured.
     */
    it('옷장을 다시 불러오기 전에는 아무 말도 하지 않는다', async () => {
      let land!: (result: { isError: boolean }) => void
      const inFlight = new Promise<{ isError: boolean }>((resolve) => {
        land = resolve
      })
      const refetch = vi.fn(() => inFlight)
      const toast = vi.spyOn(toaster, 'create')

      submitWearsMock.mockImplementation((_vars, options) => options?.onError?.(fkError))
      useWardrobeMock.mockReturnValue(query({ data: [item()], refetch }))
      renderWardrobe()

      pickOne()
      await act(async () => {
        submit()
      })

      expect(refetch).toHaveBeenCalledTimes(1)
      expect(toast).not.toHaveBeenCalled()

      /**
       * And it is not silent while it waits.
       *
       * The mutation is already settled by the time `onError` runs — see
       * `entities/wear/model/queries.premise.test.tsx` — so the button lost its
       * spinner the instant the request failed and sat live through the whole
       * refetch. Measured then: a second press sent the identical set and
       * started a second refetch, which is one signed URL per garment again.
       *
       * `isPending` is mocked `false` throughout this file, so what passes here
       * can only be the screen's own recovery flag.
       */
      const button = screen.getByRole('button', { name: '1벌 기록' })
      expect(button.hasAttribute('disabled')).toBe(true)
      expect(button.getAttribute('aria-busy')).toBe('true')

      fireEvent.click(button)
      expect(submitWearsMock).toHaveBeenCalledTimes(1)
      expect(refetch).toHaveBeenCalledTimes(1)

      await act(async () => {
        land({ isError: false })
        await inFlight
      })

      expect(toast).toHaveBeenCalledTimes(1)
      // And the lock comes off, or the mode is stuck for as long as it is open.
      expect(screen.getByRole('button', { name: '1벌 기록' }).hasAttribute('disabled')).toBe(false)
      toast.mockRestore()
    })

    /**
     * The lock is on the submit and on nothing else.
     *
     * `recovering` is screen state and survives the selection it came from, so
     * reopening during the refetch shows a locked submit on the new one — a
     * measured, bounded oddity the flag's docblock argues for leaving alone.
     * What must never join it is 취소: locking that would trap the mode until
     * the refetch lands, and the failing branch carries `retry: 2` and its
     * backoff. Held down here because the two are one prop away from each other.
     */
    it('복구 중에도 취소는 눌리고, 모드가 갇히지 않는다', async () => {
      let land!: (result: { isError: boolean }) => void
      const inFlight = new Promise<{ isError: boolean }>((resolve) => {
        land = resolve
      })
      const refetch = vi.fn(() => inFlight)

      submitWearsMock.mockImplementation((_vars, options) => options?.onError?.(fkError))
      useWardrobeMock.mockReturnValue(query({ data: [item()], refetch }))
      renderWardrobe()

      pickOne()
      await act(async () => {
        submit()
      })

      const cancel = screen.getByRole('button', { name: '고르기 취소' })
      expect(cancel.hasAttribute('disabled')).toBe(false)
      fireEvent.click(cancel)
      expect(screen.queryByRole('group', { name: /입은 옷 고르기/ })).toBeNull()

      await act(async () => {
        land({ isError: false })
        await inFlight
      })
    })

    it('다시 불러오지 못하면 그렇게 말한다', async () => {
      // `void` threw this answer away, so an offline retry got the same
      // completed-sounding sentence and the half-hour deadlock came back with
      // nothing on screen saying so.
      const refetch = vi.fn().mockResolvedValue({ isError: true })
      const toast = vi.spyOn(toaster, 'create')

      submitWearsMock.mockImplementation((_vars, options) => options?.onError?.(fkError))
      useWardrobeMock.mockReturnValue(query({ data: [item()], refetch }))
      renderWardrobe()

      pickOne()
      await act(async () => {
        submit()
      })

      expect(toast.mock.calls[0][0].description).toContain('연결을 확인')
      toast.mockRestore()
    })

    /**
     * The recovery, end to end.
     *
     * This one guards the filter rather than the timing — it passes against the
     * `void` version, because the mock refetch lands synchronously and the
     * redraw is by hand. Kept for what it does cover: that `selectedIds` is
     * derived from `knownIds` at all, so a shorter wardrobe produces a shorter
     * payload without anyone touching the draft.
     */
    it('다시 불러온 뒤의 누름은 사라진 옷을 빼고 나간다', async () => {
      const refetch = vi.fn(() => {
        // What the server actually holds: i2 was deleted on another device.
        useWardrobeMock.mockReturnValue(query({ data: [item()], refetch }))
        return Promise.resolve({ isError: false })
      })
      submitWearsMock.mockImplementation((_vars, options) => options?.onError?.(fkError))
      useWardrobeMock.mockReturnValue(
        query({ data: [item(), item({ id: 'i2', title: '흰 티' })], refetch }),
      )
      const { rerender } = renderWardrobe()

      fireEvent.click(wearButton()!)
      fireEvent.click(screen.getByRole('button', { name: /마산 플리스/ }))
      fireEvent.click(screen.getByRole('button', { name: /흰 티/ }))
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: '2벌 기록' }))
      })
      expect(submitWearsMock.mock.calls[0][0].itemIds).toEqual(['i1', 'i2'])

      // The refetch has landed; the screen redraws against the shorter wardrobe.
      rerender()
      submitWearsMock.mockImplementation(() => undefined)
      fireEvent.click(screen.getByRole('button', { name: '1벌 기록' }))

      expect(submitWearsMock.mock.calls[1][0]).toEqual({ wornOn: today, itemIds: ['i1'] })
    })

    it('그 밖의 실패로는 옷장을 다시 부르지 않는다', () => {
      // A refetch re-signs every cover URL and reloads every thumbnail, so it is
      // for the one failure that says the collection is wrong — not for a
      // dropped connection, where there is nothing new to learn.
      const refetch = vi.fn().mockResolvedValue({ isError: false })
      submitWearsMock.mockImplementation((_vars, options) =>
        options?.onError?.(new Error('offline')),
      )
      useWardrobeMock.mockReturnValue(query({ data: [item()], refetch }))
      renderWardrobe()

      pickOneAndSubmit()

      expect(refetch).not.toHaveBeenCalled()
    })
  })

  /**
   * A draft outlives a reload, so it can be here before there is a screen for it
   * to be on. Four ways that goes wrong, and all four were reachable.
   */
  describe('열려 있던 초안', () => {
    it('옷장이 아직 오는 중이면 고르는 모드를 열지 않는다', () => {
      // Measured: the wear log usually lands first — the wardrobe fetch signs
      // every cover URL on the way — so the submit bar drew over the loading
      // skeletons, a mode for picking garments on a screen with none to pick.
      openWearDraft(OWNER, today, ['i1'])
      useWardrobeMock.mockReturnValue(query({ isLoading: true, isFetching: true }))
      renderWardrobe()

      expect(dateLabel()).toBeNull()
      expect(screen.queryByRole('button', { name: /벌 기록|옷을 골라주세요/ })).toBeNull()
      // The register button is untouched — it works with the network down.
      expect(registerFab()).not.toBeNull()
    })

    it('옷장을 불러오지 못한 화면에서도 열지 않는다', () => {
      openWearDraft(OWNER, today, ['i1'])
      useWardrobeMock.mockReturnValue(query({ error: new Error('offline') }))
      renderWardrobe()

      expect(dateLabel()).toBeNull()
    })

    it('오늘이 아닌 날짜의 초안은 열지 않는다', () => {
      // `wearDraft` used to check the day only when restoring. A draft for any
      // other day cannot be produced by the UI any more, but one written before
      // the date control was removed still can be — and it would have submitted
      // against a day nothing on screen names.
      openWearDraft(OWNER, '2020-01-01', ['i1'])
      useWardrobeMock.mockReturnValue(query({ data: [item()] }))
      renderWardrobe()

      expect(dateLabel()).toBeNull()
      fireEvent.click(wearButton()!)
      expect(dateLabel()?.textContent).toBe(`${monthDay(today)} (오늘)`)
    })

    /**
     * The one the earlier test did not construct.
     *
     * Seeding a stale draft before mount exercises the restore path; this moves
     * the clock *after* mount, which is what "a tab left open across midnight"
     * actually means and the case the guard was written for. It only passes
     * because `useToday` has a timer — with the event listeners alone the bar
     * kept saying 8.15 (오늘) on the 16th and submitted against it.
     */
    it('마운트 뒤에 자정을 넘기면 닫히고, 다시 열면 새 오늘이 된다', () => {
      vi.useFakeTimers()
      try {
        vi.setSystemTime(new Date(2026, 7, 15, 23, 59, 0))
        useWardrobeMock.mockReturnValue(query({ data: [item()] }))
        renderWardrobe()

        fireEvent.click(wearButton()!)
        expect(dateLabel()?.textContent).toBe('8.15 (오늘)')

        // No visibilitychange and no focus — the window was simply looked at.
        act(() => {
          vi.advanceTimersByTime(2 * 60 * 1000)
        })

        expect(dateLabel()).toBeNull()

        fireEvent.click(wearButton()!)
        expect(dateLabel()?.textContent).toBe('8.16 (오늘)')
      } finally {
        vi.useRealTimers()
      }
    })

    it('다른 사용자의 초안은 열지 않는다', () => {
      // localStorage survives a sign-out. Without the owner check the next
      // person's screen opens holding a stranger's picks, with none of the
      // ticked cards visible, and the submit fails on the foreign key.
      openWearDraft('another-user', today, ['i1'])
      useWardrobeMock.mockReturnValue(query({ data: [item()] }))
      renderWardrobe()

      expect(dateLabel()).toBeNull()
      expect(wearButton()).not.toBeNull()
    })
  })

  /**
   * Two stores hold item ids the wardrobe can outlive, and `dropItemWears`
   * reaches only one of them, only in this tab. Deleting on a second device or
   * walking to 설정 → 처분한 옷 with a selection already open both get past it.
   *
   * What made that worth guarding is the size of the failure: the id rides along
   * on the submit, `set_item_wears` trips `item_wears_item_fk`, and because the
   * function is one transaction the whole day fails rather than just that
   * garment.
   */
  describe('사라진 옷', () => {
    it('열려 있는 초안에서 빠지고, 개수와 그리드와 제출이 같이 줄어든다', () => {
      useWardrobeMock.mockReturnValue(query({ data: [item({ id: 'i2', title: '흰 티' })] }))
      openWearDraft(OWNER, today, ['gone', 'i2'])
      renderWardrobe()

      // One card, one in the count, one in the payload — the three readings of
      // the draft cannot disagree, which is why nothing has to be announced.
      expect(screen.queryAllByRole('button', { name: /흰 티/ })).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: '1벌 기록' }))

      expect(submitWearsMock.mock.calls[0][0]).toEqual({ wornOn: today, itemIds: ['i2'] })
    })

    it('착용 기록만 남은 유령은 버튼 개수에 잡히지 않는다', () => {
      useWardrobeMock.mockReturnValue(query({ data: [item()] }))
      useWearsMock.mockReturnValue({ data: [{ itemId: 'gone', wornOn: today }] })
      renderWardrobe()

      // 오늘 1벌 would be counting a row the database cascaded away with its
      // garment, on a screen where nothing can be pressed to remove it.
      expect(screen.queryByRole('button', { name: /기록 고치기/ })).toBeNull()
      expect(screen.getByRole('button', { name: /오늘 입은 옷 기록하기/ })).toBeDefined()
    })
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
