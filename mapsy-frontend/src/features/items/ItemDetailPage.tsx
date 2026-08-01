import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { css } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { useCurrentUserId } from '@/features/auth/useCurrentUserId'
import { categoryLabel } from '@/shared/constants/categories'
import { colorLabel } from '@/shared/constants/colors'
import { seasonLabel } from '@/shared/constants/seasons'
import { errorMessage } from '@/shared/lib/errorMessage'
import { formatDate, formatPrice } from '@/shared/lib/format'
import { ColorSwatch } from '@/shared/ui/ColorSwatch'
import { signPaths } from './api'
import { ScreenHeader } from './ScreenHeader'
import { useDeleteItem, useSetFavorite, useSetStatus, useWardrobe } from './queries'

/**
 * 옷 상세 (PRD §6.3).
 *
 * Reads from the wardrobe cache instead of fetching by id — the whole collection
 * is already loaded, so a per-item request would only add a spinner.
 */
export function ItemDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const userId = useCurrentUserId()
  const { data, isLoading } = useWardrobe()

  const setFavorite = useSetFavorite()
  const setStatus = useSetStatus()
  const remove = useDeleteItem()

  const item = data?.find((entry) => entry.id === id)
  const [fullUrls, setFullUrls] = useState<string[]>([])

  // Depends on the paths, not on `item`. Every cache patch — starring the item,
  // for instance — produces a new object, and keying the effect on that
  // identity re-signed all the URLs and remounted every <img>, so the photos
  // flickered on each tap of the star.
  const photoPaths = useMemo(
    () =>
      [...(item?.images ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((image) => image.path)
        .join('\n'),
    [item?.images],
  )

  useEffect(() => {
    // Only the thumbnail is signed by the list query; the full-size photos are
    // signed here so the grid isn't paying for URLs nobody opens.
    if (!photoPaths) {
      setFullUrls([])
      return
    }
    let active = true
    const paths = photoPaths.split('\n')

    void signPaths(paths).then((signed) => {
      if (active) setFullUrls(paths.map((p) => signed.get(p)).filter((u): u is string => !!u))
    })
    return () => {
      active = false
    }
  }, [photoPaths])

  if (isLoading) return <ScreenHeader title="옷 상세">불러오는 중…</ScreenHeader>

  if (!item) {
    return (
      <ScreenHeader title="옷 상세">
        <div className={vstack({ gap: '3' })}>
          <p className={css({ fontSize: 'sm' })}>이 옷을 찾을 수 없어요.</p>
          <Link to="/" className={css({ fontSize: 'sm', color: 'accent', textDecoration: 'underline' })}>
            내 옷장으로
          </Link>
        </div>
      </ScreenHeader>
    )
  }

  const details: [string, string | null][] = [
    ['카테고리', categoryLabel(item.categoryId)],
    ['브랜드', item.brand],
    ['사이즈', item.size],
    ['핏', item.fit],
    ['계절', item.seasons.length ? item.seasons.map(seasonLabel).join(' · ') : null],
    ['가격', formatPrice(item.price)],
    ['구매일', formatDate(item.purchasedAt)],
    ['구매처', item.purchasePlace],
    ['태그', item.tags.length ? item.tags.map((t) => `#${t}`).join(' ') : null],
    ['메모', item.memo],
  ]

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
        {fullUrls.length > 0 && (
          <div
            className={hstack({
              gap: '2',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
            })}
          >
            {fullUrls.map((url, index) => (
              <img
                key={url}
                src={url}
                alt={`${item.title} 사진 ${index + 1}`}
                className={css({
                  width: 'full',
                  flexShrink: 0,
                  scrollSnapAlign: 'center',
                  rounded: 'lg',
                  bg: 'bg.subtle',
                })}
              />
            ))}
          </div>
        )}

        {item.colors.length > 0 && (
          <div className={hstack({ gap: '3', flexWrap: 'wrap' })}>
            {item.colors.map((color) => (
              <span key={color} className={hstack({ gap: '1.5' })}>
                <ColorSwatch color={color} size="md" />
                <span className={css({ fontSize: 'sm' })}>{colorLabel(color)}</span>
              </span>
            ))}
          </div>
        )}

        <dl className={vstack({ gap: '3', alignItems: 'stretch' })}>
          {details
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className={hstack({ gap: '4', alignItems: 'flex-start' })}>
                <dt className={css({ width: '64px', flexShrink: 0, fontSize: 'xs', color: 'fg.muted' })}>
                  {label}
                </dt>
                <dd className={css({ m: '0', fontSize: 'sm', whiteSpace: 'pre-wrap' })}>{value}</dd>
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
    </ScreenHeader>
  )
}

const actionButton = css({
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
