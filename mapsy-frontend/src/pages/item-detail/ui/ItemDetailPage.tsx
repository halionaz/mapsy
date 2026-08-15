import { useMemo, useRef, useState } from 'react'
import {
  ArchiveRestore,
  CalendarCheck,
  PackageOpen,
  Pencil,
  SearchX,
  Star,
  Trash2,
} from 'lucide-react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { css, cx } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import {
  useDeleteItem,
  useSetFavorite,
  useSetStatus,
  useWardrobe,
  type ItemImage,
  type WardrobeItem,
} from '@/entities/item'
import { attachWears, useToggleWear, useWears, type Worn } from '@/entities/wear'
import { useCurrentUserId } from '@/features/auth'
import { PhotoViewer, useItemPhotos, type PhotoSlot } from '@/features/item-photos'
import { categoryLabel } from '@/shared/config/categories'
import { colorLabel } from '@/shared/config/colors'
import { seasonLabel } from '@/shared/config/seasons'
import { clamp } from '@/shared/lib/clamp'
import { errorMessage } from '@/shared/lib/errorMessage'
import { formatDate, formatDayAgo, formatPrice } from '@/shared/lib/format'
import { useLocalDays } from '@/shared/lib/useLocalDays'
import { Button, IconButton } from '@/shared/ui/Button'
import { buttonStyle } from '@/shared/ui/buttonStyle'
import { ColorSwatch } from '@/shared/ui/ColorSwatch'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ScreenHeader } from '@/shared/ui/ScreenHeader'
import { skeletonSurface } from '@/shared/ui/skeletonStyle'
import { SquarePhoto } from '@/shared/ui/SquarePhoto'
import { toaster } from '@/shared/ui/toast'

/**
 * 옷 상세 (PRD §6.3).
 *
 * Reads from the wardrobe cache instead of fetching by id — the whole collection
 * is already loaded, so a per-item request would only add a spinner.
 *
 * The screen is the same shape for every garment. Title, category and photo are
 * the only things an item is guaranteed to have, and hiding each unfilled field
 * meant two items could produce two visibly different screens — one a short
 * stub, the other a full sheet — with nothing to say whether a field was blank
 * or simply not a thing this app records. So every field keeps its row and says
 * it is empty, and the photo keeps its square whether or not there is anything
 * to put in it yet.
 */
export function ItemDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const userId = useCurrentUserId()
  const { data, isLoading } = useWardrobe()
  const { data: wearData } = useWears()
  const { today } = useLocalDays()

  const setFavorite = useSetFavorite()
  const setStatus = useSetStatus()
  const remove = useDeleteItem()
  const toggleWear = useToggleWear()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const found = data?.find((entry) => entry.id === id)

  /**
   * The garment with its wear history on it.
   *
   * Through `attachWears` on a list of one rather than a second single-item
   * summariser beside it — the grid's numbers and this screen's have to be the
   * same numbers, and two ways of adding them up is how they stop being.
   */
  const wears = useMemo(() => wearData ?? [], [wearData])
  const item = useMemo(
    () => (found ? attachWears([found], wears)[0] : undefined),
    [found, wears],
  )
  // `some`, not `itemIdsWornOn(...).has(...)`: that builds a Set of every
  // garment worn that day to answer a question about one of them.
  const wornToday = useMemo(
    () =>
      found != null &&
      wears.some((entry) => entry.itemId === found.id && entry.wornOn === today),
    [found, wears, today],
  )
  // Sorted, signed and paired in one place — the URLs are matched to the photos
  // by position, and deriving that order twice is how a tile ends up showing its
  // neighbour's photo.
  const { photos, slots, markUnloadable } = useItemPhotos(item?.images)
  const [photoIndex, setPhotoIndex] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)

  /**
   * Which photo the viewer is open on, kept in the history entry rather than in
   * component state.
   *
   * A full-screen overlay that the phone's Back gesture does not close is an
   * overlay that closes the screen underneath it instead — the user goes to put
   * the photo down and the whole item disappears. Opening it as a navigation
   * makes Back close it, and costs nothing else: react-router owns the entry, so
   * there is no hand-rolled pushState fighting its scroll restoration.
   *
   * By photo id, not URL: the URLs are re-signed, and an id still resolves after
   * that (or after a reload restores this state).
   */
  const openedPhotoId = (location.state as { photoId?: string } | null)?.photoId ?? null

  // Every branch below renders a ScreenHeader, so the live region inside it is
  // one element across all three and announces each state as it arrives.
  if (isLoading) {
    return (
      <ScreenHeader
        title="옷 상세"
        status="옷 정보를 불러오는 중이에요."
        // Through `hero`, not as the first thing in the body: the loaded screen
        // puts its photo outside the body's padding, and a placeholder that sits
        // inside it is a placeholder in the wrong place — the page would jump
        // sideways and in by 20px at the moment the item arrives, which is the
        // reflow these skeletons exist to prevent.
        hero={<SquarePhoto src={null} alt="" shape="flush" />}
      >
        <DetailSkeletonBody />
      </ScreenHeader>
    )
  }

  if (!item) {
    return (
      <ScreenHeader title="옷 상세" status="이 옷을 찾을 수 없어요.">
        <EmptyState
          icon={<SearchX size={24} />}
          title="이 옷을 찾을 수 없어요"
          description="삭제됐거나 주소가 잘못됐을 수 있어요."
          action={
            <Link to="/" className={buttonStyle({ variant: 'outline' })}>
              내 옷장으로
            </Link>
          }
        />
      </ScreenHeader>
    )
  }

  const photoCount = photos.length
  const disposed = item.status === 'disposed'

  /**
   * Which photo is centred, read back from the scroll position.
   *
   * The step is measured from where the second tile actually starts rather than
   * assumed to be the container width, so it stays right whatever the gap
   * between tiles is.
   */
  function handleStripScroll() {
    const strip = stripRef.current
    if (!strip) return
    const [first, second] = strip.children
    const step =
      first && second
        ? (second as HTMLElement).offsetLeft - (first as HTMLElement).offsetLeft
        : strip.clientWidth
    if (step <= 0) return
    setPhotoIndex(clamp(Math.round(strip.scrollLeft / step), 0, photoCount - 1))
  }

  /** Scrolls the strip to a photo, so it can follow what the viewer is showing. */
  function showInStrip(photoId: string) {
    const strip = stripRef.current
    const position = photos.findIndex((image) => image.id === photoId)
    const tile = strip?.children[position]
    const first = strip?.children[0]
    if (!strip || !(tile instanceof HTMLElement) || !(first instanceof HTMLElement)) return
    // The distance between two tiles, not one tile's `offsetLeft`. Nothing
    // between here and <body> is positioned, so a tile's offsetParent is the
    // document and its offsetLeft carries the whole page layout with it — on a
    // wide window that is the centred column's margin, which is most of a tile,
    // and the strip snaps to the wrong photo. Between siblings it cancels.
    strip.scrollTo({ left: tile.offsetLeft - first.offsetLeft })
  }

  async function handleDelete() {
    if (!userId || !item) return
    try {
      await remove.mutateAsync({ id: item.id, userId })
      setConfirmingDelete(false)
      navigate('/', { replace: true })
      toaster.create({ title: `'${item.title}'을(를) 삭제했어요.`, type: 'success' })
    } catch (e) {
      // The dialog stays open: the message names a failure of the thing it is
      // still asking about, and closing it would leave the user looking at an
      // item that is still there with no idea whether the press registered.
      toaster.create({
        title: '삭제하지 못했어요',
        description: errorMessage(e, '잠시 후 다시 시도해주세요.'),
        type: 'error',
      })
    }
  }

  return (
    <ScreenHeader
      title={item.title}
      eyebrow={categoryLabel(item.categoryId)}
      subtitle={item.brand}
      // A sentence, not the bare title: the title is already the heading two
      // elements away, and hearing the same words twice in a row reads as a
      // stutter rather than as an arrival.
      status={`${item.title} 정보를 불러왔어요.`}
      action={
        <IconButton
          label={item.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
          aria-pressed={item.isFavorite}
          active={item.isFavorite}
          onClick={() =>
            setFavorite.mutate(
              { id: item.id, isFavorite: !item.isFavorite },
              {
                onError: () =>
                  toaster.create({ title: '즐겨찾기를 바꾸지 못했어요.', type: 'error' }),
              },
            )
          }
        >
          <Star size={20} fill={item.isFavorite ? 'currentColor' : 'none'} />
        </IconButton>
      }
      hero={
        <PhotoStrip
          item={item}
          slots={slots}
          photos={photos}
          photoIndex={photoIndex}
          stripRef={stripRef}
          onScroll={handleStripScroll}
          onOpen={(photoId) => navigate(location.pathname, { state: { photoId } })}
          onLoadError={markUnloadable}
        />
      }
    >
      <div className={vstack({ gap: '7', alignItems: 'stretch' })}>
        {disposed && (
          <p className={disposedNotice}>
            <PackageOpen size={15} aria-hidden="true" />
            처분한 옷이에요. 옷장 목록에는 보이지 않아요.
          </p>
        )}

        {/* On its own line above 편집 and 처분, and the only one of the three
            that is a toggle rather than a route.

            This is the one-garment way in — the wardrobe's 오늘 입은 옷 is for
            picking a whole outfit, and coming here to add the jacket you threw
            on at lunch should not mean opening a grid to tick one square.

            `aria-pressed` rather than a label that flips between an action and a
            state: "오늘 입었어요" as a heading and as a button would be the same
            words meaning two different things depending on the fill. */}
        <Button
          variant={wornToday ? 'solid' : 'surface'}
          shape="block"
          full
          aria-pressed={wornToday}
          icon={<CalendarCheck />}
          // Preview mode has no session, and the row carries a user_id.
          disabled={!userId}
          loading={toggleWear.isPending}
          onClick={() => {
            if (!userId) return
            toggleWear.mutate(
              { itemId: item.id, userId, wornOn: today, worn: !wornToday },
              {
                onError: () =>
                  toaster.create({ title: '착용 기록을 바꾸지 못했어요.', type: 'error' }),
              },
            )
          }}
        >
          오늘 입었어요
        </Button>

        <div className={hstack({ gap: '2' })}>
          {/* No `flex: '1'` on top: `full` already means "take the rest of the
              line", and stacking a `flex` shorthand on a recipe that sets
              `flex-shrink` and `width` is the order-dependent override this
              branch documented a rule against. */}
          <Link to={`/items/${item.id}/edit`} className={buttonStyle({ full: true })}>
            <Pencil />
            편집
          </Link>
          <Button
            variant="outline"
            onClick={() =>
              setStatus.mutate(
                { id: item.id, status: disposed ? 'owned' : 'disposed' },
                {
                  onSuccess: () =>
                    toaster.create({
                      title: disposed ? '다시 보유로 옮겼어요.' : '처분 처리했어요.',
                      type: 'success',
                    }),
                  onError: () =>
                    toaster.create({ title: '상태를 바꾸지 못했어요.', type: 'error' }),
                },
              )
            }
            icon={disposed ? <ArchiveRestore /> : <PackageOpen />}
            loading={setStatus.isPending}
          >
            {disposed ? '다시 보유로' : '처분'}
          </Button>
        </div>

        <dl className={vstack({ gap: '0', alignItems: 'stretch' })}>
          {DETAIL_FIELDS.map((field) => (
            <div key={field.label} className={detailRow}>
              <dt className={detailLabel}>{field.label}</dt>
              <dd className={detailValue}>
                {field.value(item, today) ?? (
                  <span className={css({ color: 'fg.subtle' })}>
                    <span aria-hidden="true">—</span>
                    <span className={css({ srOnly: true })}>미입력</span>
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <Button
          variant="danger"
          shape="block"
          full
          icon={<Trash2 />}
          onClick={() => setConfirmingDelete(true)}
          disabled={remove.isPending}
        >
          삭제
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="이 옷을 삭제할까요?"
        description={`'${item.title}'과(와) 사진이 모두 지워져요. 되돌릴 수 없어요.`}
        confirmLabel="삭제"
        destructive
        pending={remove.isPending}
        onConfirm={() => void handleDelete()}
      />

      {/* Mounted only while open, so it starts from a known state every time
          rather than holding a stale index and zoom from the last photo.
          Closing goes back, because opening came forward. */}
      {/* Gated on the history entry alone, not on there being a photo to show.
          Unmounting when there is momentarily nothing to draw would close and
          re-open the viewer — losing the page and the zoom — over a network
          blip. The viewer draws waiting and failure itself.
          (A re-sign no longer produces that gap: react-query keeps the previous
          URLs until the new ones land. This survives as the guard for the
          states that still can — a photo deleted from under the screen.) */}
      {openedPhotoId != null && (
        <PhotoViewer
          slots={slots}
          startId={openedPhotoId}
          title={item.title}
          onPageChange={(slot) => showInStrip(slot.id)}
          onLoadError={markUnloadable}
          // Unguarded, and one press is still one pop. Where the browser has a
          // close watcher the back gesture fires `close` without touching
          // history, and where it does not the entry pops and the state that
          // renders this disappears — and removing an open <dialog> from the DOM
          // does not fire `close`. Only one of the two paths ever runs.
          onClose={() => navigate(-1)}
        />
      )}
    </ScreenHeader>
  )
}

/**
 * The photo carousel, full-bleed above the title.
 *
 * Edge to edge rather than inside the body's padding: this is the one thing on
 * the screen the user came to look at, and a garment photograph with a 20px
 * margin on each side is a garment photograph 10% smaller for no reason.
 */
function PhotoStrip({
  item,
  slots,
  photos,
  photoIndex,
  stripRef,
  onScroll,
  onOpen,
  onLoadError,
}: {
  item: WardrobeItem
  slots: PhotoSlot[]
  photos: ItemImage[]
  photoIndex: number
  stripRef: React.RefObject<HTMLDivElement | null>
  onScroll: () => void
  onOpen: (photoId: string) => void
  onLoadError: (photoId: string) => void
}) {
  const photoCount = photos.length

  return (
    <section aria-label="사진" className={vstack({ gap: '3', alignItems: 'stretch' })}>
      {photoCount === 0 ? (
        <SquarePhoto src={null} alt="" fallback="empty" shape="flush" />
      ) : (
        <div ref={stripRef} onScroll={onScroll} className={strip}>
          {/* Driven by the image rows, not by the URLs: the count is known from
              the cache immediately, so the right number of squares is on screen
              before any signing has come back. */}
          {slots.map((slot, index) => (
            <button
              key={slot.id}
              type="button"
              disabled={slot.state !== 'ready'}
              aria-label={`사진 ${index + 1} 크게 보기`}
              onClick={() => onOpen(slot.id)}
              className={tile}
            >
              <SquarePhoto
                src={slot.url}
                alt={`${item.title} 사진 ${index + 1}`}
                // The slot's own state, once `ready` is taken out of it — that
                // is the case with a photo in it, where there is no fallback to
                // draw.
                fallback={slot.state === 'ready' ? undefined : slot.state}
                // Cropped to fill, not fitted. The stored original keeps the
                // proportions it was shot in, so this does cut the ends off a
                // tall garment — which is the trade being made: a hero that
                // letterboxes a portrait photo puts two bars of page colour down
                // the sides of the one thing the screen is about. The whole
                // photograph is one tap away in the viewer, which fits it and
                // lets it be pinched and panned.
                fit="cover"
                shape="flush"
                // Only the first tile is on screen; the rest are a swipe away,
                // and fetching all five 1280px originals to show one is a cost
                // paid on the phone's connection.
                loading={index === 0 ? 'eager' : 'lazy'}
                // Feeds back into `slots`, which disables this button and drops
                // the photo from what the viewer will open.
                onLoadError={() => onLoadError(slot.id)}
              />
            </button>
          ))}
        </div>
      )}

      {/* Reserved whether or not there is more than one photo, so the block
          below starts at the same height on every item. */}
      <div className={hstack({ gap: '1.5', justify: 'center', height: '1.5' })}>
        {photoCount > 1 &&
          photos.map((image, index) => (
            <span
              key={image.id}
              className={dot}
              // Clamped rather than read straight: a photo deleted from under
              // the screen leaves the index pointing past the end.
              data-current={index === clamp(photoIndex, 0, photoCount - 1) || undefined}
            />
          ))}
      </div>
    </section>
  )
}

/**
 * Full bleed, one photo per screen.
 *
 * No padding and no gap, so a tile is exactly the width of the column and a
 * swipe moves by exactly one photograph. The previous version inset the strip by
 * the body's padding and left the neighbours peeking, which advertised that
 * there were more — but it also meant no photo was ever shown whole, and the
 * item's own picture was the one thing on the screen that never filled it. The
 * dots under the strip say the same thing without spending the width.
 */
const strip = css({
  display: 'flex',
  gap: '0',
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
})

const tile = css({
  flex: '0 0 100%',
  // `start`, not `center`. With the tile exactly as wide as the strip the two
  // agree, but `start` keeps agreeing if the column ever gains padding, where
  // centring would leave every snap position half a padding out.
  scrollSnapAlign: 'start',
  cursor: 'zoom-in',
  _disabled: { cursor: 'default' },
  // Drawn inside the tile. The strip scrolls on x, which computes overflow-y to
  // auto as well, so a ring offset outwards is clipped on all four sides.
  layerStyle: 'focusableInset',
})

const dot = css({
  width: '1.5',
  height: '1.5',
  rounded: 'full',
  bg: 'border.strong',
  transitionProperty: 'background-color, width',
  transitionDuration: 'fast',
  // The current page is a stadium rather than a bigger circle — it reads at 6px
  // where a diameter change does not.
  '&[data-current]': { width: '4', bg: 'accent' },
})

const disposedNotice = hstack({
  gap: '2',
  px: '4',
  py: '3',
  rounded: 'field',
  bg: 'bg.subtle',
  color: 'fg.muted',
  textStyle: 'caption',
})

/**
 * The screen before the item is known.
 *
 * Built from the same field list as the real screen, in the same rows at the
 * same widths, so that what arrives fills the shapes in rather than replacing
 * one screen with another. The labels are not placeholders at all — they are
 * 카테고리, 색상, 브랜드 whichever garment this turns out to be, so there is no
 * reason to draw a grey bar where the real word can go.
 *
 * The title is the one thing that cannot be reserved: it is the item's name, and
 * the header says which screen this is until it can say which item.
 */
function DetailSkeletonBody() {
  return (
    <div className={vstack({ gap: '7', alignItems: 'stretch' })} aria-hidden="true">
      {/* The photo placeholder is the header's `hero`, so that it lands in the
          same full-bleed square the real strip occupies. */}
      <div className={hstack({ gap: '2' })}>
        <div className={cx(inertButton, css({ flex: '1' }))} />
        <div className={cx(inertButton, css({ width: '24' }))} />
      </div>

      <dl className={vstack({ gap: '0', alignItems: 'stretch' })}>
        {DETAIL_FIELDS.map((field) => (
          <div key={field.label} className={detailRow}>
            <dt className={detailLabel}>{field.label}</dt>
            {/* The bar sits in a real value cell, so the row is the height of
                the line of text it is standing in for rather than the height of
                the bar. */}
            <dd className={detailValue}>
              {/* Inline `style` because the width is data, and Panda only emits
                  what it can see written in the source. */}
              <span className={valueBar} style={{ width: field.skeletonWidth }} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** A placeholder sized like a run of text, on the text's own baseline. */
const valueBar = cx(
  skeletonSurface,
  css({ display: 'inline-block', height: '2.5', rounded: 'sm', verticalAlign: 'middle' }),
)

/**
 * A button-shaped box that is not a button.
 *
 * Borrows the real button's height so the reserved space is exactly right, and
 * gives back everything that promises it can be pressed — no cursor, no hover,
 * and `aria-hidden` on the block above keeps it away from assistive technology.
 */
const inertButton = cx(
  skeletonSurface,
  css({ minHeight: 'tap', rounded: 'full' }),
)

/**
 * The field list, in one place.
 *
 * Labels and values together, because the skeleton draws the labels and the
 * loaded screen draws both, and two lists would be two lists to keep in step —
 * the skeleton silently reserving six rows for a screen that always renders
 * eleven is exactly that drift, and it is invisible until the data lands and the
 * page grows by a couple of hundred pixels.
 *
 * Every row is rendered whether or not it has anything in it. The list of fields
 * is the same for every garment, so what is missing is as much a part of the
 * screen as what is there — and the blank is the fastest route to 편집 for
 * filling it in.
 */
const DETAIL_FIELDS: {
  label: string
  /**
   * `today` is passed in rather than read from the clock here, so the row and
   * the card that sent the user to this screen cannot disagree about what day it
   * is — and so this table stays testable without freezing time.
   */
  value: (item: Worn<WardrobeItem>, today: string) => React.ReactNode | null
  /**
   * Width of this row's placeholder bar while the item loads.
   *
   * On the field rather than in a list beside it. A parallel array would have to
   * stay exactly as long as this one, and falling short is silent — an
   * out-of-range read is `undefined`, which is a legal width and draws a bar of
   * nothing. Here a field added without one does not compile.
   *
   * The values are ragged on purpose: a column of identical bars reads as a
   * table that failed to render, where uneven ones read as text that has not
   * arrived yet.
   */
  skeletonWidth: string
}[] = [
  { label: '카테고리', skeletonWidth: '55%', value: (item) => categoryLabel(item.categoryId) },
  {
    label: '착용',
    skeletonWidth: '42%',
    /**
     * The one row that says "아직" out loud instead of falling through to the
     * `—` every other field uses when it is blank.
     *
     * That dash is read as 미입력, and a garment nobody has recorded yet is not a
     * field somebody forgot to fill in — it is an answer. The grid card stays
     * silent in the same situation for the opposite reason: there, on a wardrobe
     * where nothing has been recorded yet, this sentence would be on every
     * single card.
     */
    value: (item, today) => {
      if (item.lastWornOn === null) return '아직 기록이 없어요'
      // Unreachable from a row the database wrote, but chained rather than
      // interpolated: `${null}` renders the word "null" beside a real count,
      // which is the sort of thing that only shows up in a screenshot.
      const ago = formatDayAgo(item.lastWornOn, today)
      return ago ? `${ago} · 총 ${item.wearCount}번` : `총 ${item.wearCount}번`
    },
  },
  {
    label: '색상',
    skeletonWidth: '40%',
    value: (item) =>
      item.colors.length ? (
        <span className={hstack({ gap: '3', flexWrap: 'wrap' })}>
          {item.colors.map((color) => (
            <span key={color} className={hstack({ gap: '1.5' })}>
              <ColorSwatch color={color} size="md" />
              {colorLabel(color)}
            </span>
          ))}
        </span>
      ) : null,
  },
  { label: '브랜드', skeletonWidth: '30%', value: (item) => item.brand },
  { label: '사이즈', skeletonWidth: '48%', value: (item) => item.size },
  { label: '핏', skeletonWidth: '35%', value: (item) => item.fit },
  {
    label: '계절',
    skeletonWidth: '60%',
    value: (item) => (item.seasons.length ? item.seasons.map(seasonLabel).join(' · ') : null),
  },
  { label: '가격', skeletonWidth: '45%', value: (item) => formatPrice(item.price) },
  { label: '구매일', skeletonWidth: '38%', value: (item) => formatDate(item.purchasedAt) },
  { label: '구매처', skeletonWidth: '52%', value: (item) => item.purchasePlace },
  {
    label: '태그',
    skeletonWidth: '33%',
    value: (item) => (item.tags.length ? item.tags.map((tag) => `#${tag}`).join(' ') : null),
  },
  { label: '메모', skeletonWidth: '70%', value: (item) => item.memo },
]

/**
 * One field, as a row with a rule under it.
 *
 * Rules rather than the gap the list used to have. Eleven label/value pairs
 * floating in whitespace is a wall of text where nothing says which value
 * belongs to which label once a value wraps to two lines; a hairline per row
 * makes it a table without drawing one.
 */
const detailRow = css({
  display: 'flex',
  gap: '4',
  alignItems: 'flex-start',
  py: '3',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  borderColor: 'border.subtle',
  '&:last-of-type': { borderBottomWidth: '0' },
})

const detailLabel = css({
  width: '68px',
  flexShrink: 0,
  textStyle: 'caption',
  color: 'fg.muted',
  pt: '0.5',
})

const detailValue = css({ m: '0', flex: '1', textStyle: 'body', whiteSpace: 'pre-wrap' })
