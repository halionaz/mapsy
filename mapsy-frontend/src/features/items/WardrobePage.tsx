import { useState } from 'react'
import { Link } from 'react-router'
import { css, cva } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { CATEGORY_GROUPS, type CategoryGroupId } from '@/shared/constants/categories'

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
    transitionProperty: 'background-color, border-color, color',
    transitionDuration: 'fast',
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

const iconLink = css({
  fontSize: 'lg',
  color: 'fg.muted',
  p: '2',
  rounded: 'md',
  transitionProperty: 'color',
  transitionDuration: 'fast',
  _hover: { color: 'fg' },
  _focusVisible: {
    outline: '2px solid',
    outlineColor: 'accent',
    outlineOffset: '2px',
  },
})

export function WardrobePage() {
  const [activeGroup, setActiveGroup] = useState<CategoryGroupId | null>(null)
  const itemCount = 0

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
          // Clears the notch on devices where the layout runs under it.
          pt: 'calc({spacing.3} + var(--safe-t))',
        })}
      >
        <div className={hstack({ justify: 'space-between', px: '4' })}>
          <h1 className={css({ fontSize: 'xl', fontWeight: 'bold' })}>
            내 옷장
            <span className={css({ ml: '2', fontSize: 'md', color: 'fg.muted' })}>
              {itemCount}
            </span>
          </h1>
          <Link to="/settings" aria-label="설정" className={iconLink}>
            ⚙
          </Link>
        </div>

        <div className={css({ px: '4', pt: '3' })}>
          <input
            type="search"
            aria-label="옷 검색"
            placeholder="옷 이름, 브랜드, 메모, 태그 검색"
            className={css({
              width: 'full',
              bg: 'bg.subtle',
              color: 'fg',
              rounded: 'lg',
              px: '3.5',
              py: '2.5',
              fontSize: 'sm',
              _placeholder: { color: 'fg.subtle' },
              // Same ring as the chips below — a 1px border swap would be a
              // noticeably weaker focus signal than its immediate neighbours.
              _focusVisible: {
                outline: '2px solid',
                outlineColor: 'accent',
                outlineOffset: '2px',
              },
            })}
          />
        </div>

        {/* Horizontally scrolling group chips; detailed axes live in the sheet. */}
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
            className={chip({ active: activeGroup === null })}
            onClick={() => setActiveGroup(null)}
          >
            전체
          </button>
          {CATEGORY_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              aria-pressed={activeGroup === group.id}
              className={chip({ active: activeGroup === group.id })}
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
          // Room for the floating CTA plus the home indicator beneath it.
          pb: 'calc({spacing.24} + var(--safe-b))',
        })}
      >
        <div
          className={vstack({
            gap: '3',
            justify: 'center',
            flex: '1',
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
          // Sits above the home indicator rather than under it — index.html opts
          // into viewport-fit=cover, so this padding is what makes that safe.
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
