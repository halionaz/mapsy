import { useRef } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router'
import { css, cva } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

import { IconButton } from './Button'
import { useScrolledPast } from './useScrolledPast'

/**
 * Sub-screen chrome: a back affordance, the screen's name, and a padded body.
 *
 * The name is set once and large, at the top of the content, and the sticky bar
 * picks it up only after it has scrolled away — the platform pattern on both
 * phones, and the reason the bar can otherwise be almost empty. `hero` is
 * rendered above the title for screens whose subject is a photograph rather than
 * a word.
 *
 * Shared by the item create / detail / edit screens so they can't drift apart on
 * safe-area padding, which is invisible on a simulator and obvious on a phone.
 */
export function ScreenHeader({
  title,
  eyebrow,
  subtitle,
  action,
  hero,
  status,
  flushBottom = false,
  children,
}: {
  title: string
  /** A short line above the title — a category, a count. */
  eyebrow?: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  /** Full-bleed content between the bar and the title, e.g. the photo strip. */
  hero?: React.ReactNode
  /**
   * What a screen reader should be told about the state of this screen.
   *
   * Lives here rather than in the screen because a live region is read when its
   * contents *change*: one that appears with its text already in it is
   * announced by some screen readers and not others, and one that unmounts when
   * the data lands never says that the wait is over. Every state of a screen
   * renders this same header, so the region survives the switch between them and
   * the wait and its result are two values of one element.
   */
  status?: string
  /**
   * Lets the body run all the way to the bottom edge of the screen.
   *
   * The default padding is what keeps the last line of a scrolling page clear of
   * the home indicator. A screen that pins something to that edge itself — the
   * item form's action bar — has to be able to reach it, and then owns the safe
   * area inset instead. The choice lives here rather than as a negative margin
   * at the call site so the padding is still stated in exactly one place.
   */
  flushBottom?: boolean
  children: React.ReactNode
}) {
  const navigate = useNavigate()
  const barRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const collapsed = useScrolledPast(titleRef, barRef)

  return (
    <div className={vstack({ gap: '0', alignItems: 'stretch', flex: '1' })}>
      <p role="status" className={css({ srOnly: true })}>
        {status ?? ''}
      </p>

      <header ref={barRef} className={bar} data-collapsed={collapsed || undefined}>
        <IconButton label="뒤로" onClick={() => navigate(-1)}>
          <ChevronLeft size={22} />
        </IconButton>

        {/* The bar's copy of the title. `aria-hidden` because the real heading is
            the <h1> below and is always in the accessibility tree — announcing
            both would read the screen's name twice on entry. */}
        <span className={barTitle} aria-hidden="true">
          {title}
        </span>

        {/* Reserves the same width as the back button when there is no action,
            so the bar title stays optically centred either way. */}
        <div className={css({ minWidth: 'tap', display: 'flex', justifyContent: 'flex-end' })}>
          {action}
        </div>
      </header>

      {hero}

      <main className={main({ flushBottom })}>
        <div ref={titleRef} className={vstack({ gap: '1.5', alignItems: 'stretch', mb: '6' })}>
          {eyebrow && (
            <p className={css({ textStyle: 'eyebrow', color: 'accent.text' })}>{eyebrow}</p>
          )}
          <h1 className={css({ textStyle: 'title', wordBreak: 'keep-all' })}>{title}</h1>
          {subtitle && <p className={css({ textStyle: 'body', color: 'fg.muted' })}>{subtitle}</p>}
        </div>

        {children}
      </main>
    </div>
  )
}

const bar = hstack({
  position: 'sticky',
  top: '0',
  zIndex: 'header',
  justify: 'space-between',
  gap: '2',
  px: '2',
  pt: 'calc({spacing.2} + var(--safe-t))',
  pb: '2',
  // Opaque from the start rather than only once scrolled: the bar is pinned over
  // content, and a transparent one lets a photograph slide underneath it.
  bg: 'bg',
  borderBottomWidth: '1px',
  borderBottomStyle: 'solid',
  // The rule appears with the collapsed title, so an unscrolled screen reads as
  // one surface instead of a page with a toolbar bolted to it.
  borderColor: 'transparent',
  transitionProperty: 'border-color',
  transitionDuration: 'normal',
  '&[data-collapsed]': { borderColor: 'border.subtle' },
})

const barTitle = css({
  flex: '1',
  minWidth: 0,
  textStyle: 'subheading',
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  opacity: 0,
  translate: 'auto',
  translateY: '4px',
  transitionProperty: 'opacity, translate',
  transitionDuration: 'normal',
  transitionTimingFunction: 'out',
  '[data-collapsed] &': { opacity: 1, translateY: '0' },
  _motionReduce: { transitionDuration: '1ms' },
})

/**
 * A recipe rather than a `css()` with a ternary in it.
 *
 * Panda reads source at build time and cannot see through
 * `pb: flush ? '0' : '…'` — it would emit neither value and the body would
 * silently lose its bottom padding on every screen. Variants are the supported
 * way to branch.
 *
 * A flex column so a child can claim the leftover height: the item form's action
 * bar uses `margin-top: auto` to sit on the bottom edge when the form is shorter
 * than the screen, which a block container has no free space to give it.
 */
const main = cva({
  base: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    px: '5',
    pt: '5',
  },
  variants: {
    flushBottom: {
      true: { pb: '0' },
      false: { pb: 'calc({spacing.12} + var(--safe-b))' },
    },
  },
  defaultVariants: { flushBottom: false },
})
