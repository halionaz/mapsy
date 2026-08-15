import { useMemo, useRef, useState } from 'react'
import {
  Plus,
  RotateCcw,
  Search,
  SearchX,
  Settings,
  Shirt,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Link } from 'react-router'
import { css, cx } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { useDiscardUpload, usePendingUploads, useRetryUpload, useWardrobe } from '@/entities/item'
import { attachWears, itemIdsWornOn, useSetWears, useWears } from '@/entities/wear'
import {
  applyFilters,
  appliedFilters,
  clearFilters,
  deriveFilterOptions,
  EMPTY_FILTERS,
  removeApplied,
  SORT_OPTIONS,
  WardrobeFilterSheet,
  type WardrobeFilters,
} from '@/features/wardrobe-filter'
import {
  closeWearDraft,
  openWearDraft,
  toggleWearDraftItem,
  useWearDraft,
  WearFab,
  WearSelectionBar,
} from '@/features/wear-log'
import { useCurrentUserId } from '@/features/auth'
import { CATEGORY_GROUPS, groupIdOf, type CategoryGroupId } from '@/shared/config/categories'
import { assertNever } from '@/shared/lib/assertNever'
import { errorMessage, hasErrorCode } from '@/shared/lib/errorMessage'
import { useToday } from '@/shared/lib/useToday'
import { Button } from '@/shared/ui/Button'
import { buttonStyle, iconButtonStyle } from '@/shared/ui/buttonStyle'
import { chipStyle } from '@/shared/ui/chipStyle'
import { EmptyState } from '@/shared/ui/EmptyState'
import { inputStyle } from '@/shared/ui/fieldStyle'
import { skeletonSurface } from '@/shared/ui/skeletonStyle'
import { toaster } from '@/shared/ui/toast'
import { useScrolledPast } from '@/shared/ui/useScrolledPast'
import { groupSections } from '../lib/sections'
import { GridSkeleton, WardrobeGrid } from './WardrobeGrid'

/**
 * The five things this screen can be.
 *
 * Up here with the component rather than down among the style declarations,
 * where these two were first written. That placement is not cosmetic: this file
 * is 700 lines, a new top-level declaration lands wherever the last edit was,
 * and down there every gap already had somebody's docblock in it — three
 * separate blocks were pulled off the symbol they described that way, `page`'s
 * among them. Screen logic beside the screen leaves no such gap to land in.
 */
type View = 'loading' | 'failed' | 'empty' | 'noMatches' | 'grid'

/**
 * Which screens the stale banner belongs on.
 *
 * A `Record` rather than a list of `view === …` comparisons: the comparisons
 * said in prose that a new view "has to be placed here on purpose", and prose
 * does not stop anyone — a sixth view would simply never get a banner, silently.
 * Keyed by the union, adding one stops the compiler until it is answered for.
 */
const SHOWS_STALE_NOTICE: Record<View, boolean> = {
  loading: false,
  // The whole screen is already the failure; a banner on top would say it twice.
  failed: false,
  empty: true,
  noMatches: true,
  grid: true,
}

/**
 * 내 옷장 — the home screen (PRD §6.1).
 *
 * Every axis runs against the in-memory collection, so search, chips, the filter
 * sheet and sorting all land without a round trip.
 *
 * All of it is one `WardrobeFilters` value rather than a state variable per
 * control. The sheet, the category rail and the search box were otherwise three
 * separate sources feeding one `applyFilters` call, and the summary row — which
 * has to describe all of them at once and remove any one of them — is only
 * writable against a single object.
 */
export function WardrobePage() {
  const { data, isLoading, isFetching, error, refetch } = useWardrobe()
  const { data: wearData } = useWears()
  const submitWears = useSetWears()
  const pending = usePendingUploads()
  const retry = useRetryUpload()
  const discard = useDiscardUpload()

  const userId = useCurrentUserId()
  const today = useToday()
  // Both guards live in the store: whose draft it is, and whether its day is
  // still the one the app writes. See `wearDraft.isUsable`.
  const draft = useWearDraft(userId, today)

  const [filters, setFilters] = useState<WardrobeFilters>(EMPTY_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)
  /**
   * The wardrobe refetch a failed submit starts, as something the screen can
   * show.
   *
   * A flag of its own because the mutation's `isPending` cannot serve: it is
   * already false when `onError` is entered, and nothing waits for that callback
   * either — `entities/wear/model/queries.premise.test.tsx` pins both against
   * the real library. Without this the submit button lost its spinner the moment
   * the request failed and sat there live and silent for the length of the
   * refetch, which is one signed URL per garment on the success path and, with
   * `retry: 2` in the providers, several seconds of backoff on the failing one.
   *
   * Measured before it existed: pressing again in that window sent the identical
   * set and started a second refetch. The same screen already learned this at
   * the stale banner's 다시 시도, which is `loading={isFetching}` for exactly
   * this reason — silence is what makes someone press twice.
   *
   * Not `isFetching`, though. That is true for any refetch including the one
   * window focus starts, and locking the submit button on those would be a
   * control disabled by something the user did not do.
   *
   * **It outlives the selection it came from, and that is left alone.** Cancel
   * during the refetch, reopen, pick again, and the new selection's submit is
   * locked with a spinner on it until the old refetch lands — measured, along
   * with the two things that keep it bounded: 취소 is never blocked, and nothing
   * is submitted.
   *
   * The lock half is right either way, because the wardrobe really is being
   * replaced underneath. The spinner is the part that lies, and every way of
   * removing it is worse. Splitting the prop so recovery only disables would
   * take the spinner off the *ordinary* path too, where it is true — the press
   * is still being handled, the failure and the refetch are one operation to
   * whoever pressed. Clearing the flag on cancel gives that press back and
   * re-opens the wasted round trip this flag was added to stop. Tying it to the
   * draft is correct in both and is state plumbing for a window that needs a
   * cross-device delete, a submit, a cancel *during* the refetch, and a reopen
   * to reach — after which it clears itself in under a second.
   */
  const [recovering, setRecovering] = useState(false)
  const stickSentinel = useRef<HTMLDivElement>(null)
  const statusStrip = useRef<HTMLDivElement>(null)
  const stuck = useScrolledPast(stickSentinel, statusStrip)

  /**
   * Which garments this client still has. Everything below filters through it.
   *
   * Two stores hold item ids that the wardrobe can outlive — the wear log, and
   * the draft — and `dropItemWears` reaches only the first. Measured with a
   * selection open while the garment is deleted from 설정 → 처분한 옷: the
   * button counts a garment that has no card, the selection has it ticked with
   * no way to untick it, and the submit dies on `item_wears_item_fk` — which
   * rolls the whole function back, so the day cannot be recorded at all.
   *
   * This is a gate on **what this tab knows**, and that is the whole of its
   * reach. A garment deleted on another device is still in `data` here, so it
   * passes straight through and the submit fails exactly as above; the `23503`
   * arm in `submitSelection` is what handles that one, by pulling the wardrobe
   * again so the next press has a shorter set.
   *
   * Within that reach it is also why nothing has to be said to the user: the
   * count, the grid and the payload all derive from this, so a garment that is
   * gone was never on screen to be explained.
   *
   * Every status, not just `owned`. A disposed garment still exists and its wear
   * rows are still real — it is *deleted* ones that have nothing to point at.
   */
  const knownIds = useMemo(() => new Set((data ?? []).map((item) => item.id)), [data])

  /**
   * The wear log, and whether it has answered yet.
   *
   * `data !== undefined`, not "there are rows": somebody who has never recorded
   * anything gets `[]`, and that is an answer. What the distinction is for is in
   * `canRecord` below.
   */
  const wears = useMemo(
    () => (wearData ?? []).filter((entry) => knownIds.has(entry.itemId)),
    [wearData, knownIds],
  )
  const wearsAnswered = wearData !== undefined

  /**
   * The wardrobe with each garment's wear history on it.
   *
   * Merged here rather than in either query, so a wear toggle never touches the
   * item cache — refetching that entry re-signs every cover URL and reloads every
   * thumbnail in the grid.
   */
  const entries = useMemo(() => attachWears(data ?? [], wears), [data, wears])
  const visible = useMemo(() => applyFilters(entries, filters), [entries, filters])
  /**
   * What is in the wardrobe, before search and before any chip.
   *
   * Both the rail and the filter sheet offer only values this collection
   * actually holds, and both have to read it from *here* rather than from
   * `visible`: options derived from the filtered result would rewrite themselves
   * on every keystroke, and the control the user is holding would disappear from
   * under their finger mid-search.
   *
   * Filtered by `status` because the grid only ever draws one status. A brand —
   * or a whole category — that exists solely on a disposed garment would
   * otherwise be offered as a chip that can match nothing, and a filter that
   * returns nothing reads as the user's mistake.
   */
  const inWardrobe = useMemo(
    () => entries.filter((entry) => entry.status === filters.status),
    [entries, filters.status],
  )
  const options = useMemo(() => deriveFilterOptions(inWardrobe), [inWardrobe])
  const applied = appliedFilters(filters)
  // The same list, not a second walk of the same axes.
  const filterCount = applied.length
  const ownedCount = entries.filter((entry) => entry.status === 'owned').length
  const activeGroup = filters.groupIds[0] ?? null
  const hasWardrobe = entries.length > 0 || pending.length > 0

  /**
   * The category chips this wardrobe has any use for.
   *
   * All eight groups were drawn unconditionally, so someone who owns no
   * 원피스/셋업, no 가방 and no 액세서리 scrolled past three chips that could only
   * ever empty the screen.
   *
   * Not because an axis ought to offer only what exists — the sheet's 색상 and
   * 계절 list their whole preset on purpose, and `filterOptions.ts` sets out
   * why. Because of where this axis lives: an unowned colour chip sits behind a
   * sheet somebody has to open, while an unowned category chip lies across the
   * home screen for everyone, every time.
   *
   * The active group is kept in the list even once it holds nothing. Disposing
   * of the last pair of shoes while 신발 is selected otherwise takes the lit chip
   * off screen while its filter stays applied, and the lit chip is the only
   * thing on the page naming the category being looked at — the summary row
   * deliberately does not carry 대분류 (`filterSummary.ts`). The screen empties
   * with nothing left explaining why.
   *
   * Not because there would be no way out: that state is `noMatches`, whose
   * 필터 모두 해제 clears `groupIds` directly.
   *
   * There are states where the rail is hidden and nothing can clear the filter,
   * and they need nothing — hidden means the list below is at most one group, so
   * every owned garment is already inside the selected one and the filter
   * excludes nothing. It could only begin excluding something once a second
   * group exists, and that is the same moment the rail comes back.
   */
  const railGroups = useMemo(() => {
    // The element type is named rather than inferred, and that is the whole
    // reason the argument is there. `new Set(…)` takes its type from what it is
    // handed, so it absorbs an `undefined` element without a word — measured on
    // a deliberately broken category table, dropping the argument is what turns
    // three failing call sites into two, with this one silently among the
    // survivors. See `ResolvableSubcategoryId`.
    const present = new Set<CategoryGroupId>(
      inWardrobe.map((entry) => groupIdOf(entry.categoryId)),
    )
    return CATEGORY_GROUPS.filter((group) => present.has(group.id) || group.id === activeGroup)
  }, [inWardrobe, activeGroup])

  /**
   * The grid, split by category.
   *
   * Always the source of what is drawn, even when there is only one section —
   * the alternative was a second `visible`-fed grid beside this one, which is
   * two sources for the same cards and drew an empty `<ul>` on the one screen
   * where `visible` is empty but the wardrobe is not: a first registration still
   * uploading. Here, no sections means no lists.
   */
  const sections = useMemo(() => groupSections(visible), [visible])

  /**
   * More than one section — the condition behind two things: the headings, and
   * whether the sort control names the grouping (`orderLabel` below).
   *
   * Deliberately not "is 전체 selected". A lone heading names everything on the
   * screen, which the title above already does — and measured, every filter axis
   * that has a control leaves one section standing all by itself: the rail and
   * the search box here, 즐겨찾기 and six more in the sheet. Nine, and with the
   * wardrobe simply having one group so far, ten ways in. A rule each would be
   * ten rules; the count is one.
   *
   * Nine rather than `applyFilters`' eleven predicates: `status` is fixed to
   * owned, and nothing in the app writes `categoryIds`.
   */
  const sectioned = sections.length > 1

  // `data !== undefined`, not "there are rows". An empty wardrobe is an answer:
  // `data: []` means the fetch succeeded and this person owns nothing yet, and a
  // later refetch failing does not take that answer back. Asking "are there rows
  // to draw" instead put a new user's first screen — 아직 등록한 옷이 없어요 —
  // behind a load failure the moment a focus refetch missed.
  const answered = data !== undefined

  /**
   * Which of the five things this screen can be, decided once.
   *
   * The conditions used to be spelled out again at each branch and once more
   * for the FAB, and that duplication has been wrong twice — both times because
   * a value that means "no rows to draw" was read as "the wardrobe is empty".
   * First `entries`, which is `data ?? []` and so is empty while loading; then
   * `error`, which react-query sets *alongside* `data` rather than instead of
   * it. A failed background refetch therefore replaced a wardrobe that was
   * entirely in memory with an error screen — and `refetchOnWindowFocus` is on
   * deliberately (AppProviders), so coming back to the app without signal was
   * enough to trigger it.
   *
   * `failed` is now only the cold case: the fetch failed and there is nothing
   * cached to fall back on. A failure with rows in hand is simply not `failed`;
   * which view it *is* depends on the filters, and `SHOWS_STALE_NOTICE` above is
   * what answers the banner for each of them.
   *
   * Which is why that Record carries `noMatches` and not only `grid`. Measured:
   * a search left in the box when a focus refetch misses puts a wardrobe that is
   * entirely in memory on 조건에 맞는 옷이 없어요, with the banner over it. An
   * entry that looks unused there is load-bearing.
   */
  const view: View = isLoading
    ? 'loading'
    : error != null && !answered
      ? 'failed'
      : !hasWardrobe
        ? 'empty'
        : visible.length === 0 && pending.length === 0
          ? 'noMatches'
          : 'grid'

  /**
   * A failure worth mentioning over the top of a screen that still works.
   *
   * Read off `view` rather than re-tested against `hasWardrobe`, so it cannot
   * disagree with the branch that is actually drawn.
   */
  const stale = error != null && SHOWS_STALE_NOTICE[view]

  /**
   * Whether a selection is actually in progress, which is not the same question
   * as whether a draft exists.
   *
   * A draft survives a reload (`wearDraft.ts`), so on a cold start it is here
   * before the wear log is. Rendering the mode from it that early would put
   * checkboxes on the cards while `recordedIds` is still empty — and the submit
   * button would then write that empty set over the day. Everything below reads
   * `selecting`, never `draft`, and the mode simply appears a moment later.
   */
  /**
   * Whether this screen can record at all.
   *
   * Not on 옷장을 불러오지 못했어요 and not on the empty wardrobe — the first has
   * no collection to pick from and the second has nothing in it. `noMatches`
   * keeps it: the filters are still reachable from inside the mode, so a search
   * that currently matches nothing is a state to type out of, not a dead end.
   *
   * `wearsAnswered` is the load-bearing term and not politeness about a spinner:
   * submitting rewrites a whole day, so a selection seeded from a collection
   * that has not arrived is an empty set about to be written over real records.
   */
  const canRecord =
    wearsAnswered && userId !== null && (view === 'grid' || view === 'noMatches')

  /**
   * Whether a selection is actually in progress, which is not the same question
   * as whether a draft exists.
   *
   * A draft survives a reload, so on a cold start it is here before either query
   * is — and the wear log usually lands first, because the wardrobe fetch also
   * signs every cover URL. Without the gate the submit bar drew over the loading
   * skeletons, and over 옷장을 불러오지 못했어요: a mode for picking garments, on a
   * screen with no garments to pick. Both measured.
   *
   * `canRecord`, not `wearsAnswered`, so every screen the mode is wrong on is
   * excluded by one condition rather than by a list that has to be kept in step
   * with `View`.
   */
  const selecting = canRecord ? draft : null

  /**
   * What the day holds — every wear recorded against it, disposed garments
   * included.
   *
   * That is a different population from the grid, which draws `owned` only, so
   * the two can disagree: dispose of something worn today and the button
   * says 오늘 2벌 over a single card. The count is right — it describes the
   * record — and narrowing it to what is on screen would be worse, because the
   * hidden garment stays in the submitted set either way and would then be
   * neither visible nor counted.
   */
  const recordedIds = useMemo(() => itemIdsWornOn(wears, today), [wears, today])

  /**
   * What is actually picked — the draft, minus anything that is no longer a
   * garment.
   *
   * The draft is written once and then outlives whatever happens to the
   * wardrobe: open a selection, walk to 설정 → 처분한 옷, delete one of the
   * garments it is holding, come back, and the id is still in it. Filtering here
   * rather than at submit is what keeps the three readings of it — the ticks on
   * the grid, the count on the button, and the payload — from disagreeing.
   */
  const selectedIds = useMemo(
    () => (selecting ? new Set(selecting.itemIds.filter((id) => knownIds.has(id))) : null),
    [selecting, knownIds],
  )

  function setGroup(groupId: CategoryGroupId | null) {
    setFilters((current) => ({ ...current, groupIds: groupId ? [groupId] : [] }))
  }

  /**
   * Opens today, seeded with what it already holds.
   *
   * No day argument, because there is no other day to pass — the date is a
   * label now and `wearDraft.isUsable` refuses anything else. It comes back
   * when the date picker does.
   */
  function startSelecting() {
    // Narrowing `string | null`, and nothing more than that. `canRecord` is
    // what keeps it unreachable; if it ever were reached the wear button would
    // do nothing, which is worth knowing rather than claiming cannot happen.
    if (!userId) return
    openWearDraft(userId, today, itemIdsWornOn(wears, today))
  }

  function submitSelection() {
    if (!selecting || !selectedIds) return
    const { wornOn } = selecting
    // `selectedIds`, not `selecting.itemIds` — the draft may still be carrying a
    // garment that has since been deleted, and sending it makes the database
    // reject the whole day.
    const itemIds = [...selectedIds]

    submitWears.mutate(
      { wornOn, itemIds },
      {
        // The mode closes on success and only on success. A failure has to leave
        // the user still holding what they picked — there is nowhere else for it
        // to be, and asking someone to walk the grid a second time is the worst
        // possible answer to a dropped request.
        onSuccess: () => {
          closeWearDraft()
          toaster.create({
            title:
              itemIds.length > 0
                ? `오늘 입은 옷 ${itemIds.length}벌을 기록했어요.`
                : '오늘 기록을 지웠어요.',
            type: 'success',
          })
        },
        /**
         * `23503` — a garment in the selection is gone from the database.
         *
         * Reachable only from a delete this tab did not see: another device, or
         * another window. `dropItemWears` and `knownIds` between them cover
         * every delete made *here*, and neither can see one made elsewhere.
         *
         * The refetch is not cosmetic. `staleTime` is 30 minutes and focus
         * refetch respects it, and this mutation invalidates nothing — so
         * without it the collection stays wrong and the button fails
         * identically, every press, for half an hour. Pulling the wardrobe
         * again shrinks `knownIds`, which drops the garment out of the
         * selection.
         *
         * **Awaited**, and the message waits with it. `knownIds` is derived from
         * `data`, so nothing about the selection changes until the refetch
         * lands — and `fetchWardrobe` signs every cover URL on the way, which is
         * not a short trip. Announcing "다시 불러왔으니 한 번 더 눌러주세요"
         * before that was an instruction that re-sent the identical set;
         * measured, the second press carried the same two ids.
         *
         * Waiting also makes the failed refetch sayable. `void` discarded that
         * answer, so an offline retry got the same completed-sounding sentence
         * and the half-hour deadlock came straight back.
         *
         * Neither branch tells the user to press again. Once the garment is out
         * of the selection there may be nothing left to send — the submit button
         * goes to 옷을 골라주세요, or the wardrobe empties and the mode closes
         * altogether — and the screen says which of those it is better than a
         * toast written before the answer arrived.
         */
        onError: async (e) => {
          if (!hasErrorCode(e, '23503')) {
            toaster.create({
              title: '기록하지 못했어요',
              description: errorMessage(e, '잠시 후 다시 시도해주세요.'),
              type: 'error',
            })
            return
          }

          setRecovering(true)
          try {
            // `refetch` resolves with the failure rather than rejecting, but the
            // catch is there because that is a react-query option away from
            // being untrue, and an unhandled rejection inside `onError` is
            // invisible.
            const result = await refetch().catch(() => null)

            toaster.create({
              title: '기록하지 못했어요',
              description:
                result != null && !result.isError
                  ? // What happened, not what to do next. The garment is out of
                    // the selection now, and whether anything is left to send is
                    // a question the button below answers better than a sentence
                    // written before the answer arrived.
                    '옷장에 없는 옷이 섞여 있었어요. 그 옷을 빼고 목록을 새로 불러왔어요.'
                  : '옷장을 새로 불러오지 못했어요. 연결을 확인한 뒤 다시 시도해주세요.',
              type: 'error',
            })
          } finally {
            setRecovering(false)
          }
        },
      },
    )
  }

  const sortLabel = SORT_OPTIONS.find((option) => option.id === filters.sort)?.label ?? ''

  /**
   * What the screen is actually ordered by, which stops being the sort alone
   * the moment there are headings.
   *
   * Sections run in the category table's order, so the sort survives only inside
   * one — measured: with the default 최근 등록순 and a 가방 registered today
   * against three garments from January, the new bag draws last on the page. The
   * button sat above every section saying 최근 등록순, which is a control
   * promising an order the screen does not have; the sharp version is that a
   * registration sits pinned at the top as a pending card and drops to the
   * bottom the instant its upload lands.
   *
   * Grouping is what the user asked for, and no ordering makes both true at
   * once, so the label says both instead: 갈래별 · 최근 등록순.
   */
  const orderLabel = sectioned ? `갈래별 · ${sortLabel}` : sortLabel

  return (
    <div className={page}>
      <div className={wash} aria-hidden="true" />

      <div className={titleBlock}>
        {/* `hstack` centres by default, and that default is the right one here:
            the title's line box is 29px tall and the settings button is a 44px
            tap target, so top-aligning them sat the gear about 8px below the
            title's optical centre. */}
        <div className={hstack({ justify: 'space-between' })}>
          <h1 className={css({ textStyle: 'title' })}>
            내 옷장
            <span className={css({ ml: '2', color: 'fg.subtle' })}>{ownedCount}</span>
          </h1>
          <Link to="/settings" aria-label="설정" className={settingsLink}>
            <Settings size={20} />
          </Link>
        </div>
      </div>

      {/*
        The strip the bar leaves uncovered once it is pinned below the inset.
        Fixed rather than sticky so its height never enters the flow — a bar that
        grew by the inset at the moment it stuck would shove the whole grid down
        by 47px in one frame.

        It is also the measuring stick for the trigger below: its height *is*
        `--safe-t`, so the line the sentinel has to cross and the distance the bar
        is offset by are the same number read from the same element, and cannot
        drift apart.
      */}
      <div ref={statusStrip} className={statusStripScrim} data-stuck={stuck || undefined} aria-hidden="true" />

      {/* Zero height, and the whole trigger for the bar below.
          It sits exactly where the bar's top edge rests, so the moment it
          crosses the top of the viewport is the moment the bar becomes stuck —
          which is the moment its background has to appear. Measuring the bar
          itself instead would tie the trigger to its height, and the bar grows a
          row whenever a filter is applied. */}
      <div ref={stickSentinel} />

      {/* Pinned while the grid scrolls: these are the controls that change what
          is on screen, and having to scroll back up to reach them is what makes
          a long wardrobe tiring to browse. The title above is not a control and
          is allowed to leave. */}
      <div className={controls} data-stuck={stuck || undefined}>
        {/* Nothing is added here while garments are being picked. The day and
            the way out both live in `WearSelectionBar` at the bottom of the
            screen, next to the thumb that is scrolling — a strip up here is the
            one part of a long wardrobe that has to be scrolled back to. */}
        <div className={hstack({ gap: '2', px: '5' })}>
          <div className={css({ position: 'relative', flex: '1' })}>
            <Search size={16} aria-hidden="true" className={searchIcon} />
            <input
              type="search"
              value={filters.query}
              onChange={(e) => setFilters((current) => ({ ...current, query: e.target.value }))}
              aria-label="옷 검색"
              placeholder="이름, 브랜드, 메모, 태그"
              className={inputStyle({ withLeadingIcon: true })}
            />
          </div>

          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label={filterCount > 0 ? `필터 ${filterCount}개 적용됨` : '필터'}
            className={cx(
              iconButtonStyle({ shape: 'square', filled: true, active: filterCount > 0 }),
              filterButton,
            )}
          >
            <SlidersHorizontal size={19} />
            {filterCount > 0 && (
              <span className={badge} aria-hidden="true">
                {filterCount}
              </span>
            )}
          </button>
        </div>

        {/* Hidden at one group, not just at none: 전체 and 상의 select the same
            garments in a wardrobe that is all 상의, so the row would be two
            chips that cannot disagree. It reappears the moment a second
            category is registered. */}
        {railGroups.length > 1 && (
          <div className={rail}>
            <button
              type="button"
              aria-pressed={activeGroup === null}
              className={chipStyle({ active: activeGroup === null })}
              onClick={() => setGroup(null)}
            >
              전체
            </button>
            {railGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                aria-pressed={activeGroup === group.id}
                className={chipStyle({ active: activeGroup === group.id })}
                onClick={() => setGroup(group.id)}
              >
                {group.label}
              </button>
            ))}
          </div>
        )}

        {/* Only the axes the sheet owns. The category is already a lit chip in
            the rail above, and giving it a second removable pill here would be
            two controls for one choice. */}
        {applied.length > 0 && (
          <div className={rail}>
            {applied.map((entry) => (
              <button
                key={entry.key}
                type="button"
                aria-label={`${entry.label} 필터 해제`}
                className={chipStyle({ active: true })}
                onClick={() => setFilters((current) => removeApplied(current, entry))}
              >
                {entry.label}
                <X size={13} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>

      <main className={main}>
        {/* Outside the branches, and always mounted.
            A live region is read when its contents *change*, so one that appears
            with its text already in it is announced by some screen readers and
            not others — and one that unmounts when the data lands never says
            that the wait is over. Kept here it changes from the wait to the
            result, which is both announcements in one element.
            Absolutely positioned by `srOnly`, so it is out of flow and does not
            take a slot in the column's gap. */}
        <p role="status" className={css({ srOnly: true })}>
          {/* Entering and leaving selection mode changes what a tap on the grid
              does, and nothing else says so out loud — the checkboxes are drawn,
              and `aria-pressed` only speaks when a card is activated. Constant
              while the mode is on, so this is announced on the way in and on the
              way out rather than at every tap. */}
          {selecting ? '오늘 입은 옷을 고르는 중이에요. ' : ''}
          {view === 'loading'
            ? '옷장을 불러오는 중이에요.'
            : view === 'failed'
              ? '옷장을 불러오지 못했어요.'
              : view === 'empty' || view === 'noMatches' || view === 'grid'
                ? `옷 ${visible.length}벌${stale ? '. 최신 목록은 불러오지 못했어요.' : ''}`
                : assertNever(view)}
        </p>

        {/* Over the wardrobe, not instead of it: the rows on screen are real,
            they just may be a few minutes old.

            No `role="alert"` on it. The region above is always mounted and its
            text already changed to say this — an alert here would be a second
            live region announcing the same fact, and it would read the retry
            button's label as part of the sentence. The banner is what the sighted
            user sees; the region above is what everyone else hears. */}
        {stale && (
          <div className={staleNotice}>
            <TriangleAlert size={15} aria-hidden="true" className={css({ flexShrink: 0 })} />
            <span className={css({ flex: '1' })}>최신 목록을 불러오지 못했어요</span>
            {/* `outline`, not `ghost`: a ghost button's hover fill is
                `bg.subtle`, which is what this banner is painted in, so hovering
                changed only the text colour. An outline carries its own edge and
                that edge is what moves. */}
            <Button
              size="sm"
              variant="outline"
              icon={<RotateCcw />}
              loading={isFetching}
              onClick={() => void refetch()}
            >
              다시 시도
            </Button>
          </div>
        )}

        {view === 'loading' ? (
          <div className={vstack({ gap: '4', alignItems: 'stretch' })}>
            {/* The placeholders are decoration — six empty list items is not
                what a screen reader should be given to walk through. */}
            <div className={listMeta} aria-hidden="true">
              <span
                className={cx(skeletonSurface, css({ width: '10', height: '2.5', rounded: 'sm' }))}
              />
            </div>
            <GridSkeleton />
          </div>
        ) : view === 'failed' ? (
          <EmptyState
            tone="danger"
            icon={<TriangleAlert size={24} />}
            title="옷장을 불러오지 못했어요"
            description={errorMessage(error)}
            action={
              // `isFetching`, not `isLoading`: once a query has errored its
              // status stays 'error' through the retry, so `isLoading` is false
              // the whole time. With `retry: 2` in the providers that is several
              // silent seconds, and the user presses again — once per press.
              <Button
                variant="outline"
                icon={<RotateCcw />}
                loading={isFetching}
                onClick={() => void refetch()}
              >
                다시 시도
              </Button>
            }
          />
        ) : view === 'empty' ? (
          <EmptyState
            icon={<Shirt size={24} />}
            title="아직 등록한 옷이 없어요"
            description="사진 찍고 이름만 붙이면 등록 끝. 나머지는 나중에 채워도 괜찮아요."
            action={
              <Link to="/items/new" className={buttonStyle()}>
                <Plus />첫 옷 등록하기
              </Link>
            }
          />
        ) : view === 'noMatches' ? (
          <EmptyState
            icon={<SearchX size={24} />}
            title="조건에 맞는 옷이 없어요"
            description="검색어를 줄이거나 필터를 풀어보세요."
            action={
              <Button
                variant="outline"
                // `clearFilters`, like the sheet's 초기화, plus the two things
                // this button can also see: the search box and the category
                // rail. `EMPTY_FILTERS` additionally reset the sort, so
                // pressing it while reading 가격 높은순 silently went back to
                // 최근 등록순 — two controls, one wording, different effects.
                onClick={() =>
                  setFilters((current) => ({
                    ...clearFilters(current),
                    query: '',
                    groupIds: [],
                  }))
                }
              >
                필터 모두 해제
              </Button>
            }
          />
        ) : view === 'grid' ? (
          <div className={vstack({ gap: '4', alignItems: 'stretch' })}>
            <div className={listMeta}>
              <span className={css({ textStyle: 'caption', color: 'fg.muted' })}>
                {visible.length}벌
              </span>
              {/* Opens the sheet rather than being a <select>. A native dropdown
                  is the one control on this screen the app cannot style, and it
                  was also a second place sorting could be changed from. */}
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className={buttonStyle({ variant: 'ghost', size: 'sm' })}
              >
                {orderLabel}
                <SlidersHorizontal size={13} aria-hidden="true" />
              </button>
            </div>

            <WardrobeGrid
              sections={sections}
              pending={pending}
              onRetry={retry}
              onDiscard={discard}
              sectioned={sectioned}
              today={today}
              selectedIds={selectedIds}
              onToggleItem={toggleWearDraftItem}
            />
          </div>
        ) : (
          // Unreachable: every member of `View` is named above, which is the
          // point — a sixth would stop compiling here rather than falling through
          // to the grid and being quietly drawn as one.
          assertNever(view)
        )}
      </main>

      {/* Two separately pinned buttons rather than a row, which is what puts 옷
          등록 back at the exact centre of the screen — a row would have centred
          the *pair* and left the register button sitting off to one side.

          The wear button is held to the right edge of the app column instead of
          the window, so it does not drift out into the page margin on a tablet.
          Its slot spans the column, so `pointer-events` is off on the slot and
          back on for the button — otherwise an invisible full-width strip would
          be swallowing taps on the bottom row of the grid. */}
      {selecting === null ? (
        <>
          {/* Hidden while the empty-wardrobe screen is on show: it already
              offers 첫 옷 등록하기 in the middle of it, and two identical pills
              pointing at the same route is the app asking twice. */}
          {view !== 'empty' && (
            <Link to="/items/new" aria-label="옷 등록" className={cx(buttonStyle(), fab)}>
              <Plus />옷 등록
            </Link>
          )}

          {canRecord && (
            <div className={wearFabSlot}>
              <WearFab
                recordedCount={recordedIds.size}
                // The same signal the control bar sticks on, rather than a
                // second scroll listener that could disagree with it about
                // where the top of the page ended.
                collapsed={stuck}
                onOpen={startSelecting}
              />
            </div>
          )}
        </>
      ) : (
        <WearSelectionBar
          wornOn={selecting.wornOn}
          selectedCount={selectedIds?.size ?? 0}
          recordedCount={recordedIds.size}
          submitting={submitWears.isPending || recovering}
          onSubmit={submitSelection}
          onCancel={closeWearDraft}
        />
      )}

      <WardrobeFilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        filters={filters}
        onChange={setFilters}
        options={options}
        resultCount={visible.length}
      />
    </div>
  )
}

/**
 * The screen column, and a stacking context.
 *
 * `isolation: isolate` is what lets the wash sit at `z-index: -1` and stay
 * visible: without a stacking context of its own here, a negative index would
 * put the wash behind the shell's background instead of behind this screen's
 * content, and it would simply disappear. The pair replaces the previous
 * arrangement, where the wash stayed behind only for as long as every sibling
 * above it remembered to be `position: relative` — a contract kept by comments
 * in two files, and already only half kept: `main` never was.
 */
const page = cx(
  vstack({ gap: '0', alignItems: 'stretch', flex: '1' }),
  css({
    // Both, and they do different jobs. `position: relative` is what makes this
    // the containing block for the absolutely positioned wash — `isolation` only
    // opens a stacking context, and is not on the short list of properties that
    // establish a containing block. Swapping one for the other left the wash
    // resolving `inset-inline: 0` against the viewport: on any window wider than
    // the 480px column it painted an orange band across the whole page with the
    // phone column floating in the middle of it, and in preview mode it started
    // above the banner instead of behind the title.
    position: 'relative',
    // Lets the wash sit at `z-index: -1` and land behind this screen's content
    // rather than behind the page background, where an unisolated negative index
    // would put it — invisibly.
    isolation: 'isolate',
  }),
)

const titleBlock = css({
  px: '5',
  pt: 'calc({spacing.4} + var(--safe-t))',
  pb: '4',
})

/**
 * The colour wash behind the top of the screen.
 *
 * Replaces a radial glow that came in from the top-right corner. A corner blob
 * reads as a decoration someone put on the page; a full-width band that starts
 * saturated at the very top edge and falls away into the page colour reads as
 * the page having a top — which is the thing being borrowed here.
 *
 * Absolutely positioned inside the screen column rather than fixed, so it
 * scrolls away with the title instead of sitting under the grid forever. It is
 * behind the pinned bar (no z-index against the bar's `zIndex: header`), which
 * is what lets the bar be transparent until it sticks.
 *
 * `pointer-events: none` because it covers the title row and the settings link.
 */
const wash = css({
  position: 'absolute',
  zIndex: -1,
  top: '0',
  insetInline: '0',
  height: '320px',
  pointerEvents: 'none',
  background: 'linear-gradient(180deg, {colors.accent} 0%, transparent 78%)',
  // The gradient's own alpha does the shape; this sets how loud it starts.
  // Louder in dark, where the wash has a near-black to sit on and the same
  // strength would barely register.
  opacity: { base: 0.1, _dark: 0.18 },
})

/**
 * The settings button, pulled out to the screen's optical margin.
 *
 * A 20px glyph centred in a 44px tap target has 12px of air on each side, so a
 * button whose *box* ends at the 20px page inset leaves the glyph ending at 32px
 * — visibly further in than everything under it, because the filter button below
 * is filled and its box is what the eye lines up against. Pulling the box out by
 * that 12px puts the two visible right edges on the same line and leaves the tap
 * target its full size.
 *
 * `ScreenHeader`'s bar needs no equivalent: its own inset is already 8px, which
 * is the 20px body inset minus the back chevron's 11px of internal air.
 */
const settingsLink = cx(iconButtonStyle(), css({ mr: '-3' }))

/**
 * The pinned control bar, and the two states it has.
 *
 * At rest it sits inside the wash and is transparent, so the colour runs
 * unbroken from the top edge past the chips and out — the bar is part of the
 * band rather than a panel laid on top of it. Once it sticks there is content
 * scrolling underneath, so it takes an opaque background; the hairline arrives
 * with it, because a rule over the wash would be drawing a border around
 * nothing.
 *
 * The switch is exact rather than gradual: `position: sticky` has no in-between,
 * so the frame the bar starts covering content is the frame the sentinel above
 * crosses the viewport top. The transition only softens the colour change.
 */
const controls = css({
  position: 'sticky',
  // Pinned *below* the inset rather than at the viewport edge, so the search
  // field never sits under the clock. The inset itself is counted once, by
  // `titleBlock`, which is the surface at the top of the page while the page is
  // at rest; adding it here too — the previous attempt — pushed a 47px band of
  // nothing between the title and the search box on every notched phone, since
  // both are in flow until the bar sticks. Padding cannot be right in both
  // states, so the bar moves its anchor instead of growing.
  top: 'var(--safe-t)',
  zIndex: 'header',
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  pt: '1',
  pb: '3',
  bg: 'transparent',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderColor: 'transparent',
  transitionProperty: 'background-color, border-color',
  transitionDuration: 'normal',
  transitionTimingFunction: 'out',
  '&[data-stuck]': { bg: 'bg', borderColor: 'border.subtle' },
  _motionReduce: { transitionDuration: '1ms' },
})

/**
 * Covers the safe-area strip above the pinned bar, and only while it is pinned.
 *
 * Constrained to the app column rather than the window: the shell centres a
 * 480px column, and a full-width strip would paint over the page on either side
 * of it on a tablet, where the top inset is not always zero.
 */
const statusStripScrim = css({
  position: 'fixed',
  top: '0',
  left: '50%',
  translate: 'auto',
  translateX: '-1/2',
  width: 'full',
  maxWidth: 'app',
  height: 'var(--safe-t)',
  zIndex: 'header',
  bg: 'bg',
  opacity: 0,
  pointerEvents: 'none',
  transitionProperty: 'opacity',
  transitionDuration: 'normal',
  transitionTimingFunction: 'out',
  '&[data-stuck]': { opacity: 1 },
  _motionReduce: { transitionDuration: '1ms' },
})

/**
 * The line that says the list may be out of date. Informational, not alarming.
 *
 * It was drawn in `danger`, the same pair as a validation error that blocks
 * submission and the confirm on a delete. Nothing here is broken — the garments
 * on screen are real and a few minutes old — and painting that the same red as
 * an irreversible action flattens three levels of severity into one.
 */
const staleNotice = hstack({
  gap: '2',
  mb: '4',
  px: '3',
  py: '2',
  rounded: 'field',
  bg: 'bg.subtle',
  color: 'fg.muted',
  textStyle: 'caption',
})

const searchIcon = css({
  position: 'absolute',
  left: '4',
  top: '50%',
  translate: 'auto',
  translateY: '-1/2',
  color: 'fg.subtle',
  pointerEvents: 'none',
})

// Only what the recipe has no variant for: the badge is absolutely positioned
// against this button, so it needs a containing block.
const filterButton = css({ position: 'relative' })

const badge = css({
  position: 'absolute',
  top: '1',
  right: '1',
  display: 'grid',
  placeItems: 'center',
  minWidth: '4',
  height: '4',
  px: '1',
  rounded: 'full',
  bg: 'accent',
  color: 'accent.fg',
  fontSize: '2xs',
  fontWeight: 'bold',
})

const rail = css({
  display: 'flex',
  gap: '2',
  overflowX: 'auto',
  px: '5',
  // A 36px chip in a 44px band, so the row is a comfortable target even though
  // the chips themselves are under the floor.
  py: '1',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
})

const main = css({
  flex: '1',
  display: 'flex',
  flexDirection: 'column',
  px: '5',
  pt: '4',
  pb: 'calc({spacing.24} + var(--safe-b))',
})

/**
 * The count-and-sort line above the grid.
 *
 * Given a fixed height so the loading state can reserve exactly this much — a
 * row that measures itself is a row the placeholder cannot match, which would
 * leave the grid dropping by its height the moment the data lands, the reflow
 * the skeletons exist to prevent.
 */
const listMeta = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '9',
})

/**
 * The register button, pinned above the home indicator.
 *
 * Centred rather than in a corner: this is a one-handed screen and the middle of
 * the bottom edge is the part of a phone both thumbs reach. `fixed` positions it
 * against the viewport — nothing between here and the root has a transform, so
 * the app column's own `position: relative` does not capture it — and the column
 * is centred too, which is what keeps the two agreeing.
 *
 * The glow is its alone. The wear button beside it is drawn on a surface rather
 * than in the accent, and an accent-tinted shadow under a neutral pill reads as
 * a rendering mistake — the shadow would be the only orange thing about it.
 */
const fab = css({
  position: 'fixed',
  bottom: 'calc({spacing.6} + var(--safe-b))',
  left: '50%',
  translate: 'auto',
  translateX: '-1/2',
  zIndex: 'fab',
  boxShadow: 'fab',
})

/**
 * Where the wear button sits: the right-hand end of the app column, on the same
 * line as the register button.
 *
 * A full-width slot rather than `right: 20px`, because "right" here means the
 * column's edge and not the window's — the shell centres 480px, and on anything
 * wider the button would otherwise float off in the page margin.
 *
 * `pointerEvents: none` on the slot and back on for its child. The slot spans
 * the whole column at the height of the bottom row of cards, and an invisible
 * strip that eats taps is the kind of bug that reads as the grid being broken.
 */
const wearFabSlot = css({
  position: 'fixed',
  bottom: 'calc({spacing.6} + var(--safe-b))',
  left: '50%',
  translate: 'auto',
  translateX: '-1/2',
  zIndex: 'fab',
  display: 'flex',
  justifyContent: 'flex-end',
  width: 'calc(100vw - {spacing.10})',
  maxWidth: 'calc({sizes.app} - {spacing.10})',
  pointerEvents: 'none',
  '& > *': { pointerEvents: 'auto' },
})
