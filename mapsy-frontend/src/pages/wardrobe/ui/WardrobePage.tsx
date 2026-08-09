import { useMemo, useState } from 'react'
import { Plus, Search, SearchX, Settings, Shirt, SlidersHorizontal, TriangleAlert, X } from 'lucide-react'
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
} from '@/entities/item'
import {
  activeFilterCount,
  applyFilters,
  appliedFilters,
  deriveFilterOptions,
  EMPTY_FILTERS,
  removeApplied,
  SORT_OPTIONS,
  WardrobeFilterSheet,
  type WardrobeFilters,
} from '@/features/wardrobe-filter'
import { CATEGORY_GROUPS, type CategoryGroupId } from '@/shared/config/categories'
import { errorMessage } from '@/shared/lib/errorMessage'
import { buttonStyle, iconButtonStyle } from '@/shared/ui/buttonStyle'
import { chipStyle } from '@/shared/ui/chipStyle'
import { EmptyState } from '@/shared/ui/EmptyState'
import { inputStyle } from '@/shared/ui/fieldStyle'
import { skeletonSurface } from '@/shared/ui/skeletonStyle'

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
  const { data, isLoading, error } = useWardrobe()
  const pending = usePendingUploads()
  const retry = useRetryUpload()
  const discard = useDiscardUpload()

  const [filters, setFilters] = useState<WardrobeFilters>(EMPTY_FILTERS)
  const [sheetOpen, setSheetOpen] = useState(false)

  const entries = useMemo(() => data ?? [], [data])
  const visible = useMemo(() => applyFilters(entries, filters), [entries, filters])
  const options = useMemo(() => deriveFilterOptions(entries), [entries])
  const applied = appliedFilters(filters)
  const filterCount = activeFilterCount(filters)
  const ownedCount = entries.filter((entry) => entry.status === 'owned').length
  const activeGroup = filters.groupIds[0] ?? null

  function setGroup(groupId: CategoryGroupId | null) {
    setFilters((current) => ({ ...current, groupIds: groupId ? [groupId] : [] }))
  }

  const sortLabel = SORT_OPTIONS.find((option) => option.id === filters.sort)?.label ?? ''

  return (
    <div className={vstack({ gap: '0', alignItems: 'stretch', flex: '1' })}>
      <div className={titleBlock}>
        <div className={glow} aria-hidden="true" />
        <div className={hstack({ justify: 'space-between', alignItems: 'flex-start' })}>
          <h1 className={css({ textStyle: 'title' })}>
            내 옷장
            <span className={css({ ml: '2', color: 'fg.subtle' })}>{ownedCount}</span>
          </h1>
          <Link to="/settings" aria-label="설정" className={iconButtonStyle()}>
            <Settings size={20} />
          </Link>
        </div>
      </div>

      {/* Pinned while the grid scrolls: these are the controls that change what
          is on screen, and having to scroll back up to reach them is what makes
          a long wardrobe tiring to browse. The title above is not a control and
          is allowed to leave. */}
      <div className={controls}>
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

        <div className={rail}>
          <button
            type="button"
            aria-pressed={activeGroup === null}
            className={chipStyle({ active: activeGroup === null })}
            onClick={() => setGroup(null)}
          >
            전체
          </button>
          {CATEGORY_GROUPS.map((group) => (
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
          {isLoading
            ? '옷장을 불러오는 중이에요.'
            : error
              ? '옷장을 불러오지 못했어요.'
              : `옷 ${visible.length}벌`}
        </p>

        {isLoading ? (
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
        ) : error ? (
          <EmptyState
            tone="danger"
            icon={<TriangleAlert size={24} />}
            title="옷장을 불러오지 못했어요"
            description={errorMessage(error)}
          />
        ) : entries.length === 0 && pending.length === 0 ? (
          <EmptyState
            icon={<Shirt size={24} />}
            title="아직 등록한 옷이 없어요"
            description="사진 찍고 이름만 붙이면 등록 끝. 나머지는 나중에 채워도 괜찮아요."
            action={
              <Link to="/items/new" className={buttonStyle()}>
                <Plus size={17} />첫 옷 등록하기
              </Link>
            }
          />
        ) : visible.length === 0 && pending.length === 0 ? (
          <EmptyState
            icon={<SearchX size={24} />}
            title="조건에 맞는 옷이 없어요"
            description="검색어를 줄이거나 필터를 풀어보세요."
            action={
              <button
                type="button"
                className={buttonStyle({ variant: 'outline' })}
                onClick={() => setFilters(EMPTY_FILTERS)}
              >
                필터 모두 해제
              </button>
            }
          />
        ) : (
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

            <ul className={grid}>
              {/* Pending registrations are pinned to the top and sit outside
                  the filters — hiding one behind a category chip would read as
                  data loss while its photos are still uploading. */}
              {pending.map((entry) => (
                <li key={entry.tempId}>
                  <PendingCard pending={entry} onRetry={retry} onDiscard={discard} />
                </li>
              ))}
              {visible.map((item) => (
                <li key={item.id}>
                  <ItemCard item={item} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>

      <Link to="/items/new" aria-label="옷 등록" className={cx(buttonStyle(), fab)}>
        <Plus size={18} />옷 등록
      </Link>

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

const titleBlock = css({
  position: 'relative',
  px: '5',
  pt: 'calc({spacing.4} + var(--safe-t))',
  pb: '4',
  overflow: 'hidden',
})

/**
 * A wash of brand orange behind the screen's name.
 *
 * The same device as the login screen, at a quarter of the strength — enough
 * that the top of the page is not flat black, faint enough that it never
 * competes with a photograph. It scrolls away with the title rather than
 * sitting behind the pinned controls, which is what keeps the grid's background
 * a single colour.
 */
const glow = css({
  position: 'absolute',
  top: '-140%',
  right: '-30%',
  width: '90%',
  aspectRatio: '1',
  pointerEvents: 'none',
  background: 'radial-gradient(circle at 50% 50%, {colors.brand.500} 0%, transparent 60%)',
  opacity: { base: 0.14, _dark: 0.22 },
})

const controls = css({
  position: 'sticky',
  top: '0',
  zIndex: 'header',
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  pt: '1',
  pb: '3',
  bg: 'bg',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderColor: 'border.subtle',
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
