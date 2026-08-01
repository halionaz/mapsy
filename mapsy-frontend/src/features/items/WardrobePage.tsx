import { useState } from 'react'
import { Link } from 'react-router'
import { css, cva } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { CATEGORY_GROUPS, type CategoryGroupId } from '../../shared/constants/categories'

/**
 * 내 옷장 — the home screen (PRD §6.1).
 *
 * Shell only for now: the layout, filter chips and empty state are real, the
 * item data is not. Fetching, filtering and the filter bottom sheet land next.
 */

const chip = cva({
  base: {
    flexShrink: 0,
    rounded: 'full',
    px: '3.5',
    py: '1.5',
    fontSize: 'sm',
    fontWeight: 'medium',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    borderWidth: '1px',
    borderStyle: 'solid',
    transition: 'background-color 120ms, border-color 120ms, color 120ms',
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent',
      outlineOffset: '2px',
    },
  },
  variants: {
    active: {
      true: {
        bg: 'accent',
        color: 'accent.fg',
        borderColor: 'accent',
      },
      false: {
        bg: 'bg',
        color: 'fg.muted',
        borderColor: 'border',
        _hover: { borderColor: 'fg.subtle' },
      },
    },
  },
  defaultVariants: {
    active: false,
  },
})

export function WardrobePage() {
  const [activeGroup, setActiveGroup] = useState<CategoryGroupId | null>(null)
  const itemCount = 0

  return (
    <div className={vstack({ gap: '0', alignItems: 'stretch' })}>
      <header
        className={css({
          position: 'sticky',
          top: '0',
          zIndex: '10',
          bg: 'bg',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderColor: 'border.subtle',
          pt: '3',
        })}
      >
        <div className={hstack({ justify: 'space-between', px: '4' })}>
          <h1 className={css({ fontSize: 'xl', fontWeight: 'bold' })}>
            내 옷장
            <span className={css({ ml: '2', fontSize: 'md', color: 'fg.muted' })}>
              {itemCount}
            </span>
          </h1>
          <Link
            to="/settings"
            aria-label="설정"
            className={css({
              fontSize: 'lg',
              color: 'fg.muted',
              p: '2',
              rounded: 'md',
              _hover: { color: 'fg' },
            })}
          >
            ⚙
          </Link>
        </div>

        <div className={css({ px: '4', pt: '3' })}>
          <input
            type="search"
            placeholder="옷 이름, 브랜드, 메모, 태그 검색"
            className={css({
              width: 'full',
              bg: 'bg.subtle',
              color: 'fg',
              rounded: 'lg',
              px: '3.5',
              py: '2.5',
              fontSize: 'sm',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'transparent',
              _placeholder: { color: 'fg.subtle' },
              _focusVisible: { outline: 'none', borderColor: 'accent' },
            })}
          />
        </div>

        {/* Horizontally scrolling group chips; detailed axes live in the sheet. */}
        <div
          className={css({
            display: 'flex',
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
            className={chip({ active: activeGroup === null })}
            onClick={() => setActiveGroup(null)}
          >
            전체
          </button>
          {CATEGORY_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              className={chip({ active: activeGroup === group.id })}
              onClick={() => setActiveGroup(group.id)}
            >
              {group.label}
            </button>
          ))}
        </div>
      </header>

      <main className={css({ flex: '1', px: '4', pb: '24' })}>
        <div
          className={vstack({
            gap: '3',
            justify: 'center',
            minHeight: '60dvh',
            textAlign: 'center',
          })}
        >
          <p className={css({ fontSize: 'md', fontWeight: 'medium' })}>
            아직 등록한 옷이 없어요
          </p>
          <p className={css({ fontSize: 'sm', color: 'fg.muted', lineHeight: 'relaxed' })}>
            사진 찍고 이름만 붙이면 등록 끝.
            <br />
            나머지는 나중에 채워도 괜찮아요.
          </p>
        </div>
      </main>

      <Link
        to="/items/new"
        aria-label="옷 등록"
        className={css({
          position: 'fixed',
          bottom: '6',
          left: '50%',
          translate: 'auto',
          translateX: '-1/2',
          bg: 'accent',
          color: 'accent.fg',
          rounded: 'full',
          px: '6',
          py: '3.5',
          fontSize: 'sm',
          fontWeight: 'semibold',
          boxShadow: 'lg',
          _hover: { opacity: 0.92 },
        })}
      >
        + 옷 등록
      </Link>
    </div>
  )
}
