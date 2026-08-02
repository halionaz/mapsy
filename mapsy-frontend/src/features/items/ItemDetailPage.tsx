import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { css, cx } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { useCurrentUserId } from '@/features/auth/useCurrentUserId'
import { categoryLabel } from '@/shared/constants/categories'
import { colorLabel } from '@/shared/constants/colors'
import { seasonLabel } from '@/shared/constants/seasons'
import { errorMessage } from '@/shared/lib/errorMessage'
import { formatDate, formatPrice } from '@/shared/lib/format'
import { ColorSwatch } from '@/shared/ui/ColorSwatch'
import { skeletonSurface } from '@/shared/ui/skeletonStyle'
import { SquarePhoto } from '@/shared/ui/SquarePhoto'
import { clamp } from '@/shared/lib/clamp'
import type { WardrobeItem } from './api'
import { signPaths } from './api'
import { photoSlots } from './photoSlots'
import { PhotoViewer } from './PhotoViewer'
import { ScreenHeader } from './ScreenHeader'
import { useDeleteItem, useSetFavorite, useSetStatus, useWardrobe } from './queries'

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

  const setFavorite = useSetFavorite()
  const setStatus = useSetStatus()
  const remove = useDeleteItem()

  const item = data?.find((entry) => entry.id === id)
  // `null` until signing settles, then one entry per photo — `null` in a slot is
  // a photo whose URL could not be signed. Keeping the slots aligned with the
  // images is what lets a tile tell "still coming" from "did not arrive".
  const [photoUrls, setPhotoUrls] = useState<(string | null)[] | null>(null)
  /** Photos whose URL was signed but which would not load. */
  const [unloadable, setUnloadable] = useState<ReadonlySet<string>>(() => new Set())
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

  // Cover first. Sorted in one place because the signed URLs are matched to
  // these by position — deriving the order twice is how a tile ends up showing
  // its neighbour's photo.
  const photos = useMemo(
    () => [...(item?.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [item?.images],
  )

  // The effect depends on the paths, not on `photos`. Every cache patch —
  // starring the item, for instance — produces a new object, and keying the
  // effect on that identity re-signed all the URLs and remounted every <img>,
  // so the photos flickered on each tap of the star.
  const photoPaths = useMemo(() => photos.map((image) => image.path).join('\n'), [photos])

  // Memoised, and not only to save the work. The viewer takes this as a prop and
  // builds its paging callback from it, so a fresh array every render is a fresh
  // callback every render — and the key handler bound to that callback would be
  // detached and reattached on each one. Swiping in the viewer scrolls the strip
  // behind it, which re-renders this screen, so "every render" is every frame of
  // a swipe.
  const slots = useMemo(
    () => photoSlots(photos, photoUrls, unloadable),
    [photos, photoUrls, unloadable],
  )

  useEffect(() => {
    // Only the thumbnail is signed by the list query; the full-size photos are
    // signed here so the grid isn't paying for URLs nobody opens.
    if (!photoPaths) {
      setPhotoUrls([])
      return
    }
    // Back to "not signed yet" before signing the new set. The previous answer
    // describes different paths, and holding onto it means that for the whole
    // round trip every tile reads its slot as empty-and-settled and claims the
    // photo failed — which is what a cold load does on the way from no item to
    // an item, so it would be the normal path, not an edge case. It also lines
    // stale URLs up against fresh indices, showing the neighbouring photo.
    setPhotoUrls(null)
    // Whatever would not load did so at a URL that no longer exists.
    setUnloadable(new Set())
    let active = true
    const paths = photoPaths.split('\n')

    void signPaths(paths)
      .then((signed) => {
        if (active) setPhotoUrls(paths.map((path) => signed.get(path) ?? null))
      })
      .catch(() => {
        // Settled, with nothing to show. Without this the tiles would sit on a
        // skeleton for good, which reads as a slow network rather than a
        // failure the user could retry by reloading.
        if (active) setPhotoUrls(paths.map(() => null))
      })
    return () => {
      active = false
    }
  }, [photoPaths])

  // Every branch below renders a ScreenHeader, so the live region inside it is
  // one element across all three and announces each state as it arrives.
  if (isLoading) {
    return (
      <ScreenHeader title="옷 상세" status="옷 정보를 불러오는 중이에요.">
        <DetailSkeletonBody />
      </ScreenHeader>
    )
  }

  if (!item) {
    return (
      <ScreenHeader title="옷 상세" status="이 옷을 찾을 수 없어요.">
        <div className={vstack({ gap: '3' })}>
          <p className={css({ fontSize: 'sm' })}>이 옷을 찾을 수 없어요.</p>
          <Link to="/" className={css({ fontSize: 'sm', color: 'accent', textDecoration: 'underline' })}>
            내 옷장으로
          </Link>
        </div>
      </ScreenHeader>
    )
  }

  const photoCount = photos.length

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
    if (!window.confirm(`'${item.title}'을(를) 삭제할까요? 되돌릴 수 없어요.`)) return
    try {
      await remove.mutateAsync({ id: item.id, userId })
      navigate('/', { replace: true })
    } catch {
      // Swallowed here so it isn't an unhandled rejection; the message is
      // rendered from `remove.error` below. Without that the button looked
      // simply broken — nothing happened and nothing was said.
    }
  }

  return (
    <ScreenHeader
      title={item.title}
      // A sentence, not the bare title: the title is already the heading two
      // elements away, and hearing the same words twice in a row reads as a
      // stutter rather than as an arrival.
      status={`${item.title} 정보를 불러왔어요.`}
      action={
        <button
          type="button"
          aria-label={item.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}
          aria-pressed={item.isFavorite}
          onClick={() => setFavorite.mutate({ id: item.id, isFavorite: !item.isFavorite })}
          className={css({
            fontSize: 'lg',
            p: '2',
            rounded: 'md',
            cursor: 'pointer',
            color: item.isFavorite ? 'accent' : 'fg.subtle',
            _focusVisible: {
              outline: '2px solid',
              outlineColor: 'accent',
              outlineOffset: '2px',
            },
          })}
        >
          {item.isFavorite ? '★' : '☆'}
        </button>
      }
    >
      <div className={vstack({ gap: '6', alignItems: 'stretch' })}>
        <section aria-label="사진" className={vstack({ gap: '2', alignItems: 'stretch' })}>
          {photoCount === 0 ? (
            <SquarePhoto src={null} alt="" fallback="empty" />
          ) : (
            <div
              ref={stripRef}
              onScroll={handleStripScroll}
              className={css({
                display: 'flex',
                gap: '2',
                overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                scrollbarWidth: 'none',
                '&::-webkit-scrollbar': { display: 'none' },
              })}
            >
              {/* Driven by the image rows, not by the URLs: the count is known
                  from the cache immediately, so the right number of squares is
                  on screen before any signing has come back. */}
              {slots.map((slot, index) => (
                <button
                  key={slot.id}
                  type="button"
                  disabled={slot.state !== 'ready'}
                  aria-label={`사진 ${index + 1} 크게 보기`}
                  onClick={() => navigate(location.pathname, { state: { photoId: slot.id } })}
                  className={css({
                    flex: '0 0 100%',
                    scrollSnapAlign: 'center',
                    rounded: 'lg',
                    cursor: 'zoom-in',
                    _disabled: { cursor: 'default' },
                    _focusVisible: {
                      // Drawn inside the tile. The strip scrolls on x, which
                      // computes overflow-y to auto as well, so a ring offset
                      // outwards is clipped on all four sides — the tile is
                      // exactly as wide as the strip and exactly as tall.
                      outline: '2px solid',
                      outlineColor: 'accent',
                      outlineOffset: '-3px',
                    },
                  })}
                >
                  <SquarePhoto
                    src={slot.url}
                    alt={`${item.title} 사진 ${index + 1}`}
                    // The slot's own state, once `ready` is taken out of it —
                    // that is the case with a photo in it, where there is no
                    // fallback to draw.
                    fallback={slot.state === 'ready' ? undefined : slot.state}
                    // The stored original keeps the proportions it was shot in,
                    // so it is fitted into the square rather than cropped to
                    // it — half a long coat is not a picture of a coat.
                    fit="contain"
                    // Only the first tile is on screen; the rest are a swipe
                    // away, and fetching all five 1280px originals to show one
                    // is a cost paid on the phone's connection. Browsers judge
                    // "near the viewport" generously — a good deal more than one
                    // tile's width — so this defers the far end of a long strip
                    // rather than everything past the first.
                    loading={index === 0 ? 'eager' : 'lazy'}
                    // Feeds back into `slots`, which disables this button and
                    // drops the photo from what the viewer will open. Returns
                    // the same set when the id is already in it: a new one every
                    // time would be a new state value every time, and this can
                    // be called on a re-render.
                    onLoadError={() =>
                      setUnloadable((failed) =>
                        failed.has(slot.id) ? failed : new Set(failed).add(slot.id),
                      )
                    }
                  />
                </button>
              ))}
            </div>
          )}

          {/* Reserved whether or not there is more than one photo, so the block
              below starts at the same height on every item. */}
          <div className={hstack({ gap: '1.5', justify: 'center', height: '2' })}>
            {photoCount > 1 &&
              photos.map((image, index) => (
                <span
                  key={image.id}
                  className={css({
                    width: '6px',
                    height: '6px',
                    rounded: 'full',
                    // Clamped rather than read straight: a photo deleted from
                    // under the screen leaves the index pointing past the end.
                    bg: index === clamp(photoIndex, 0, photoCount - 1) ? 'fg.muted' : 'border',
                  })}
                />
              ))}
          </div>
        </section>

        <dl className={vstack({ gap: '3', alignItems: 'stretch' })}>
          {DETAIL_FIELDS.map((field) => (
            <div key={field.label} className={detailRow}>
              <dt className={detailLabel}>{field.label}</dt>
              <dd className={detailValue}>
                {field.value(item) ?? (
                  <span className={css({ color: 'fg.subtle' })}>
                    <span aria-hidden="true">—</span>
                    <span className={css({ srOnly: true })}>미입력</span>
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
          <Link to={`/items/${item.id}/edit`} className={actionButton}>
            편집
          </Link>
          <button
            type="button"
            onClick={() =>
              setStatus.mutate({
                id: item.id,
                status: item.status === 'owned' ? 'disposed' : 'owned',
              })
            }
            disabled={setStatus.isPending}
            className={actionButton}
          >
            {item.status === 'owned' ? '처분 처리' : '다시 보유로'}
          </button>

          {(setStatus.error || setFavorite.error) && (
            <p role="alert" className={css({ fontSize: 'xs', color: 'danger', textAlign: 'center' })}>
              변경 사항을 저장하지 못했어요.
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={remove.isPending}
            className={css({
              py: '3',
              rounded: 'lg',
              fontSize: 'sm',
              color: 'danger',
              cursor: 'pointer',
              _disabled: { opacity: 0.4, cursor: 'not-allowed' },
              _focusVisible: {
                outline: '2px solid',
                outlineColor: 'accent',
                outlineOffset: '2px',
              },
            })}
          >
            {remove.isPending ? '삭제 중…' : '삭제'}
          </button>

          {remove.error && (
            <p role="alert" className={css({ fontSize: 'xs', color: 'danger', textAlign: 'center' })}>
              삭제하지 못했어요.{' '}
              {errorMessage(remove.error, '잠시 후 다시 시도해주세요.')}
            </p>
          )}
        </div>
      </div>

      {/* Mounted only while open, so it starts from a known state every time
          rather than holding a stale index and zoom from the last photo.
          Closing goes back, because opening came forward. */}
      {/* Gated on the history entry alone, not on there being a photo to show.
          A re-sign turns every slot back to pending for a moment, and
          unmounting on that would close and re-open the viewer — losing the
          page and the zoom — over a network blip. The viewer draws waiting and
          failure itself. */}
      {openedPhotoId != null && (
        <PhotoViewer
          slots={slots}
          startId={openedPhotoId}
          title={item.title}
          onPageChange={(slot) => showInStrip(slot.id)}
          onLoadError={(photoId) =>
            setUnloadable((failed) => (failed.has(photoId) ? failed : new Set(failed).add(photoId)))
          }
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
    <div className={vstack({ gap: '6', alignItems: 'stretch' })} aria-hidden="true">
      <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
        <SquarePhoto src={null} alt="" />
        <div className={css({ height: '2' })} />
      </div>

      <dl className={vstack({ gap: '3', alignItems: 'stretch' })}>
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

      <div className={vstack({ gap: '2', alignItems: 'stretch' })}>
        <div className={inertButton}>
          <span className={valueBar} style={{ width: '3rem' }} />
        </div>
        <div className={inertButton}>
          <span className={valueBar} style={{ width: '4rem' }} />
        </div>
        <div className={css({ py: '3', fontSize: 'sm', textAlign: 'center' })}>
          <span className={valueBar} style={{ width: '2.5rem' }} />
        </div>
      </div>
    </div>
  )
}

/** A placeholder sized like a run of text, on the text's own baseline. */
const valueBar = cx(
  skeletonSurface,
  css({ display: 'inline-block', height: '2.5', rounded: 'sm', verticalAlign: 'middle' }),
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
  value: (item: WardrobeItem) => React.ReactNode | null
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

const detailRow = hstack({ gap: '4', alignItems: 'flex-start' })

const detailLabel = css({ width: '64px', flexShrink: 0, fontSize: 'xs', color: 'fg.muted' })

const detailValue = css({ m: '0', flex: '1', fontSize: 'sm', whiteSpace: 'pre-wrap' })

/**
 * Kept as a style object rather than a class name, so the skeleton below can be
 * built by overriding parts of it.
 *
 * `cx` would not do: it joins class names without looking at them, so both
 * `cursor` rules would survive and which one won would come down to the order
 * Panda happened to emit them in. `css(a, b)` merges the objects first and emits
 * one rule, which is a decision rather than a coincidence.
 */
const actionButtonStyle = css.raw({
  py: '3',
  rounded: 'lg',
  fontSize: 'sm',
  fontWeight: 'medium',
  textAlign: 'center',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  color: 'fg',
  cursor: 'pointer',
  _hover: { borderColor: 'fg.subtle' },
  _focusVisible: { outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' },
})

const actionButton = css(actionButtonStyle)

/**
 * A button-shaped box that is not a button.
 *
 * Borrows the real button's metrics so the reserved space is exactly right, and
 * gives back the parts that promise it can be pressed — `aria-hidden` keeps a
 * placeholder away from assistive technology, but a pointer would still find a
 * hand cursor and a border that answers to hover.
 */
const inertButton = css(actionButtonStyle, {
  cursor: 'default',
  _hover: { borderColor: 'border' },
})
