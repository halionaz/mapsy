import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { css } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { CATEGORY_GROUPS, type CategoryGroupId } from '@/shared/constants/categories'
import { applyFilters } from '@/features/filters/applyFilters'
import { EMPTY_FILTERS, SORT_OPTIONS, type SortId } from '@/features/filters/model'
import { chipStyle } from '@/shared/ui/chipStyle'
import { ItemCard } from './ItemCard'
import { useDiscardUpload, useRetryUpload, useWardrobe } from './queries'

/**
 * 내 옷장 — the home screen (PRD §6.1).
 *
 * Search, category chips and sorting run against the in-memory collection, so
 * every interaction lands without a round trip. The detailed filter sheet
 * (colour, size, season, brand, tag) is the remaining piece; `applyFilters`
 * already handles those axes, so it is a UI addition rather than a rewrite.
 */
export function WardrobePage() {
  const { data, isPending, error } = useWardrobe()
  const { retry } = useRetryUpload()
  const discard = useDiscardUpload()

  const [query, setQuery] = useState('')
  const [activeGroup, setActiveGroup] = useState<CategoryGroupId | null>(null)
  const [sort, setSort] = useState<SortId>('recent')

  const entries = useMemo(() => data ?? [], [data])

  // Items still uploading have no server row yet, so they are pinned to the top
  // and held out of the filtered set — hiding one behind a category chip would
  // read as data loss, and leaving them in both lists would render them twice.
  const uploading = useMemo(() => entries.filter((e) => e.upload), [entries])

  const visible = useMemo(
    () =>
      applyFilters(
        entries.filter((e) => !e.upload),
        {
          ...EMPTY_FILTERS,
          query,
          groupIds: activeGroup ? [activeGroup] : [],
          sort,
        },
      ),
    [entries, query, activeGroup, sort],
  )
  const ownedCount = entries.filter((e) => e.status === 'owned' && !e.upload).length

  return (
    <div className={vstack({ gap: '0', alignItems: 'stretch', flex: '1' })}>
      <header
        className={css({
          position: 'sticky',
          top: '0',
          zIndex: 'header',
          bg: 'bg',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderColor: 'border.subtle',
          pt: 'calc({spacing.3} + var(--safe-t))',
        })}
      >
        <div className={hstack({ justify: 'space-between', px: '4' })}>
          <h1 className={css({ fontSize: 'xl', fontWeight: 'bold' })}>
            내 옷장
            <span className={css({ ml: '2', fontSize: 'md', color: 'fg.muted' })}>
              {ownedCount}
            </span>
          </h1>
          <Link to="/settings" aria-label="설정" className={iconLink}>
            ⚙
          </Link>
        </div>

        <div className={css({ px: '4', pt: '3' })}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="옷 검색"
            placeholder="옷 이름, 브랜드, 메모, 태그 (초성 가능)"
            className={css({
              width: 'full',
              bg: 'bg.subtle',
              color: 'fg',
              rounded: 'lg',
              px: '3.5',
              py: '2.5',
              fontSize: 'sm',
              _placeholder: { color: 'fg.subtle' },
              _focusVisible: {
                outline: '2px solid',
                outlineColor: 'accent',
                outlineOffset: '2px',
              },
            })}
          />
        </div>

        <div
          className={hstack({
            gap: '2',
            overflowX: 'auto',
            px: '4',
            py: '3',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          })}
        >
          <button
            type="button"
            aria-pressed={activeGroup === null}
            className={chipStyle({ active: activeGroup === null })}
            onClick={() => setActiveGroup(null)}
          >
            전체
          </button>
          {CATEGORY_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              aria-pressed={activeGroup === group.id}
              className={chipStyle({ active: activeGroup === group.id })}
              onClick={() => setActiveGroup(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>
      </header>

      <main
        className={css({
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          px: '4',
          pt: '4',
          pb: 'calc({spacing.24} + var(--safe-b))',
        })}
      >
        {isPending ? (
          <Centered>불러오는 중…</Centered>
        ) : error ? (
          <Centered>
            <p className={css({ color: 'danger', fontSize: 'sm' })}>
              옷장을 불러오지 못했어요.
            </p>
            <p className={css({ fontSize: 'xs', color: 'fg.muted' })}>
              {error instanceof Error ? error.message : String(error)}
            </p>
          </Centered>
        ) : entries.length === 0 ? (
          <Centered>
            <p className={css({ fontSize: 'md', fontWeight: 'medium' })}>
              아직 등록한 옷이 없어요
            </p>
            <p className={css({ fontSize: 'sm', color: 'fg.muted', lineHeight: 'relaxed' })}>
              사진 찍고 이름만 붙이면 등록 끝.
              <br />
              나머지는 나중에 채워도 괜찮아요.
            </p>
          </Centered>
        ) : (
          <div className={vstack({ gap: '4', alignItems: 'stretch' })}>
            <div className={hstack({ justify: 'space-between' })}>
              <span className={css({ fontSize: 'xs', color: 'fg.muted' })}>
                {visible.length}벌
              </span>
              <label className={css({ fontSize: 'xs', color: 'fg.muted' })}>
                <span className={css({ srOnly: true })}>정렬</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortId)}
                  className={css({
                    bg: 'bg',
                    color: 'fg.muted',
                    fontSize: 'xs',
                    cursor: 'pointer',
                    _focusVisible: {
                      outline: '2px solid',
                      outlineColor: 'accent',
                      outlineOffset: '2px',
                    },
                  })}
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <ul
              className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '3',
                listStyle: 'none',
                p: '0',
                m: '0',
              })}
            >
              {[...uploading, ...visible].map((entry) => (
                <li key={entry.id}>
                  <ItemCard entry={entry} onRetry={retry} onDiscard={discard} />
                </li>
              ))}
            </ul>

            {visible.length === 0 && uploading.length === 0 && (
              <p
                className={css({
                  py: '10',
                  textAlign: 'center',
                  fontSize: 'sm',
                  color: 'fg.muted',
                })}
              >
                조건에 맞는 옷이 없어요.
              </p>
            )}
          </div>
        )}
      </main>

      <Link
        to="/items/new"
        aria-label="옷 등록"
        className={css({
          position: 'fixed',
          bottom: 'calc({spacing.6} + var(--safe-b))',
          left: '50%',
          translate: 'auto',
          translateX: '-1/2',
          zIndex: 'fab',
          bg: 'accent',
          color: 'accent.fg',
          rounded: 'full',
          px: '6',
          py: '3.5',
          fontSize: 'sm',
          fontWeight: 'semibold',
          boxShadow: 'lg',
          transitionProperty: 'opacity',
          transitionDuration: 'fast',
          _hover: { opacity: 0.92 },
          _focusVisible: {
            outline: '2px solid',
            outlineColor: 'accent',
            outlineOffset: '2px',
          },
        })}
      >
        + 옷 등록
      </Link>
    </div>
  )
}

const iconLink = css({
  fontSize: 'lg',
  color: 'fg.muted',
  p: '2',
  rounded: 'md',
  transitionProperty: 'color',
  transitionDuration: 'fast',
  _hover: { color: 'fg' },
  _focusVisible: { outline: '2px solid', outlineColor: 'accent', outlineOffset: '2px' },
})

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={vstack({
        gap: '3',
        justify: 'center',
        flex: '1',
        textAlign: 'center',
      })}
    >
      {children}
    </div>
  )
}
