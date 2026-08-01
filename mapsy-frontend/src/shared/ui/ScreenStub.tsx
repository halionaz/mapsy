import { Link } from 'react-router'
import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

/**
 * Placeholder for a route that exists in the router but has no implementation
 * yet. Keeping the routes wired from the start means navigation, layout and
 * deep links are testable before the screens land.
 */

interface ScreenStubProps {
  title: string
  note: string
}

export function ScreenStub({ title, note }: ScreenStubProps) {
  return (
    <div
      className={vstack({
        gap: '3',
        justify: 'center',
        flex: '1',
        px: '8',
        pt: 'calc({spacing.8} + var(--safe-t))',
        pb: 'calc({spacing.8} + var(--safe-b))',
        textAlign: 'center',
      })}
    >
      <h1 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>{title}</h1>
      <p className={css({ fontSize: 'sm', color: 'fg.muted', lineHeight: 'relaxed' })}>
        {note}
      </p>
      <Link
        to="/"
        className={css({
          mt: '2',
          fontSize: 'sm',
          color: 'accent',
          textDecoration: 'underline',
          rounded: 'sm',
          _focusVisible: {
            outline: '2px solid',
            outlineColor: 'accent',
            outlineOffset: '2px',
          },
        })}
      >
        내 옷장으로
      </Link>
    </div>
  )
}
