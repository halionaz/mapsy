import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

/**
 * The screen has nothing to show, and says which kind of nothing.
 *
 * One component for all three because they were three different layouts before —
 * an empty wardrobe, a filter that matched nothing, and a load that failed each
 * centred their own stack at their own sizes. They are the same moment from the
 * user's side (I am looking at a blank screen) and should look like it.
 *
 * The icon sits in a tinted circle rather than loose on the background: a lone
 * outline glyph in the middle of an empty screen reads as a broken image.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  tone?: 'neutral' | 'danger'
}) {
  return (
    <div
      className={vstack({
        gap: '3',
        justify: 'center',
        flex: '1',
        py: '16',
        px: '6',
        textAlign: 'center',
      })}
    >
      <span className={tone === 'danger' ? dangerBadge : neutralBadge} aria-hidden="true">
        {icon}
      </span>
      <p className={css({ textStyle: 'heading' })}>{title}</p>
      {description && (
        <p
          className={css({
            textStyle: 'body',
            color: 'fg.muted',
            maxWidth: 'field',
            wordBreak: 'keep-all',
          })}
        >
          {description}
        </p>
      )}
      {action && <div className={css({ mt: '2' })}>{action}</div>}
    </div>
  )
}

const badgeBase = {
  display: 'grid',
  placeItems: 'center',
  width: '14',
  height: '14',
  rounded: 'full',
  mb: '1',
} as const

const neutralBadge = css({ ...badgeBase, bg: 'bg.subtle', color: 'fg.subtle' })
const dangerBadge = css({ ...badgeBase, bg: 'danger.subtle', color: 'danger' })
