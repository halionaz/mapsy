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

import {
  CardSkeleton,
  ItemCard,
  PendingCard,
  useDiscardUpload,
  usePendingUploads,
  useRetryUpload,
  useWardrobe,
  type WardrobeItem,
} from '@/entities/item'
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
import { CATEGORY_GROUPS, type CategoryGroupId } from '@/shared/config/categories'
import { assertNever } from '@/shared/lib/assertNever'
import { errorMessage } from '@/shared/lib/errorMessage'
import { Button } from '@/shared/ui/Button'
import { buttonStyle, iconButtonStyle } from '@/shared/ui/buttonStyle'
import { chipStyle } from '@/shared/ui/chipStyle'
import { EmptyState } from '@/shared/ui/EmptyState'
import { inputStyle } from '@/shared/ui/fieldStyle'
import { skeletonSurface } from '@/shared/ui/skeletonStyle'
import { useScrolledPast } from '@/shared/ui/useScrolledPast'
import { groupSections } from '../lib/sections'

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
  const pending = usePendingUploads()
  const retry = useRetryUpload()
  const discard = useDiscardUpload()

  const [filters, setFilters] = useState<WardrobeFilters>(EMPTY_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)
  const stickSentinel = useRef<HTMLDivElement>(null)
  const statusStrip = useRef<HTMLDivElement>(null)
  const stuck = useScrolledPast(stickSentinel, statusStrip)

  const entries = useMemo(() => data ?? [], [data])
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
   * ever empty the screen. Offering only what exists is the rule the filter
   * sheet already follows for brands and sizes; the rail was the one axis left
   * out of it.
   *
   * The active group is kept in the list even once it holds nothing, and that is
   * the whole reason this is not simply `groupSections(inWardrobe)`. Disposing
   * of the last pair of shoes while 신발 is selected would otherwise take the lit
   * chip off screen and leave its filter applied, with no way to reach it — the
   * summary row below deliberately does not carry 대분류 (`filterSummary.ts`),
   * so there would be nothing left to press.
   */
  const railGroups = useMemo(() => {
    const present = new Set(groupSections(inWardrobe).map((section) => section.group.id))
    return CATEGORY_GROUPS.filter((group) => present.has(group.id) || group.id === activeGroup)
  }, [inWardrobe, activeGroup])

  /**
   * The grid split by category, drawn only when there is more than one.
   *
   * The count is the whole condition, and it is deliberately not "is 전체
   * selected". A lone heading names everything on the screen, which the title
   * above already does — and the cases where that happens all reduce to the same
   * sentence rather than needing a rule each: a chip is lit, or the search
   * narrowed to one category, or the wardrobe is nothing but 상의 so far.
   */
  const sections = useMemo(() => groupSections(visible), [visible])

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
   * cached to fall back on. A failure with rows in hand is `staleWarning`, drawn
   * over the grid rather than in place of it.
   */
  // `data !== undefined`, not "there are rows". An empty wardrobe is an answer:
  // `data: []` means the fetch succeeded and this person owns nothing yet, and a
  // later refetch failing does not take that answer back. Asking "are there rows
  // to draw" instead put a new user's first screen — 아직 등록한 옷이 없어요 —
  // behind a load failure the moment a focus refetch missed.
  const answered = data !== undefined

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

  function setGroup(groupId: CategoryGroupId | null) {
    setFilters((current) => ({ ...current, groupIds: groupId ? [groupId] : [] }))
  }

  const sortLabel = SORT_OPTIONS.find((option) => option.id === filters.sort)?.label ?? ''

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
            <ul className={grid} aria-hidden="true">
              {SKELETON_KEYS.map((key) => (
                <li key={key}>
                  <CardSkeleton />
                </li>
              ))}
            </ul>
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
                {sortLabel}
                <SlidersHorizontal size={13} aria-hidden="true" />
              </button>
            </div>

            {/* Pinned to the top, in a grid of their own, and outside both the
                filters and the sections. Filing an upload under its category
                would bury it — a failed one has to stay where the retry can be
                found, and hiding it behind a heading reads as data loss while
                its photos are still going up. */}
            {pending.length > 0 && (
              <ul className={grid}>
                {pending.map((entry) => (
                  <li key={entry.tempId}>
                    <PendingCard pending={entry} onRetry={retry} onDiscard={discard} />
                  </li>
                ))}
              </ul>
            )}

            {sections.length > 1 ? (
              <div className={vstack({ gap: '7', alignItems: 'stretch' })}>
                {sections.map((section) => (
                  <section
                    key={section.group.id}
                    className={vstack({ gap: '3', alignItems: 'stretch' })}
                  >
                    <h2 className={sectionHeading}>
                      {section.group.label}
                      <span className={css({ ml: '2', color: 'fg.subtle' })}>
                        {section.items.length}
                      </span>
                    </h2>
                    <ItemGrid items={section.items} />
                  </section>
                ))}
              </div>
            ) : (
              <ItemGrid items={visible} />
            )}
          </div>
        ) : (
          // Unreachable: every member of `View` is named above, which is the
          // point — a sixth would stop compiling here rather than falling through
          // to the grid and being quietly drawn as one.
          assertNever(view)
        )}
      </main>

      {/* Hidden only while the empty-wardrobe screen is the one on show: that
          screen already offers 첫 옷 등록하기 in the middle of it, and two
          identical pills pointing at the same route is the app asking twice. */}
      {view !== 'empty' && (
        <Link to="/items/new" aria-label="옷 등록" className={cx(buttonStyle(), fab)}>
          <Plus />옷 등록
        </Link>
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
 * One block of cards.
 *
 * Extracted because the screen now draws two of them for different reasons — a
 * section under its heading, and the whole result when a category chip is lit —
 * and a card's markup that exists twice is a card that gets fixed once.
 */
function ItemGrid({ items }: { items: readonly WardrobeItem[] }) {
  return (
    <ul className={grid}>
      {items.map((item) => (
        <li key={item.id}>
          <ItemCard item={item} />
        </li>
      ))}
    </ul>
  )
}

/**
 * A category's name over its cards.
 *
 * `heading` rather than `subheading`: it is the only thing standing between two
 * grids of photographs, and it has to survive being read past at a scroll.
 */
const sectionHeading = css({ textStyle: 'heading' })

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
 * Shared by the loaded grid and the loading one, so the placeholders sit on the
 * same lines the cards will occupy and the screen doesn't reflow when the data
 * lands.
 */
const grid = css({
  display: 'grid',
  // `minmax(0, …)`, not a bare `1fr`.
  //
  // `1fr` is shorthand for `minmax(auto, 1fr)`, and that `auto` is the item's
  // automatic minimum size — which for a card is the min-content width of its
  // title. Titles are `white-space: nowrap`, so a title's min-content width is
  // the whole untruncated string: `overflow: hidden` decides what is *drawn*,
  // never what the text asks for. The result was a grid whose columns were
  // sized by how long each garment's name happened to be — 와이드진 wide, 흰 티
  // narrow — and since the photo is a square that fills its column, the longer
  // name also produced a taller card. Every card looked like a different size
  // because every name was a different length.
  //
  // A zero floor lets the three tracks be equal and leaves the clipping to the
  // title, which is what was asked of it.
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  // The same automatic minimum applies to the item inside the track, where it
  // would push the card back out over the track it was just made to fit.
  '& > li': { minWidth: 0 },
  gap: '3',
  listStyle: 'none',
  p: '0',
  m: '0',
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

const SKELETON_KEYS = ['a', 'b', 'c', 'd', 'e', 'f']

/**
 * The register button, pinned above the home indicator.
 *
 * Centred rather than in a corner: this is a one-handed screen with a single
 * action, and the middle of the bottom edge is the part of a phone both thumbs
 * reach. `fixed` positions it against the viewport, so it stays put while the
 * grid scrolls under it.
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
