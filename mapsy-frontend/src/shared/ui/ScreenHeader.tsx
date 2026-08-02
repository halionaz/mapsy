import { useNavigate } from 'react-router'
import { css } from 'styled-system/css'
import { hstack, vstack } from 'styled-system/patterns'

/**
 * Sub-screen chrome: a back affordance, a title, and a padded body.
 *
 * Shared by the item create / detail / edit screens so they can't drift apart on
 * safe-area padding, which is invisible on a simulator and obvious on a phone.
 */
export function ScreenHeader({
  title,
  action,
  status,
  children,
}: {
  title: string
  action?: React.ReactNode
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
  children: React.ReactNode
}) {
  const navigate = useNavigate()

  return (
    <div className={vstack({ gap: '0', alignItems: 'stretch', flex: '1' })}>
      <p role="status" className={css({ srOnly: true })}>
        {status ?? ''}
      </p>

      <header
        className={hstack({
          justify: 'space-between',
          px: '4',
          pt: 'calc({spacing.3} + var(--safe-t))',
          pb: '3',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderColor: 'border.subtle',
        })}
      >
        <div className={hstack({ gap: '1' })}>
          <button
            type="button"
            aria-label="뒤로"
            onClick={() => navigate(-1)}
            className={css({
              fontSize: 'lg',
              color: 'fg.muted',
              p: '2',
              rounded: 'md',
              cursor: 'pointer',
              _hover: { color: 'fg' },
              _focusVisible: {
                outline: '2px solid',
                outlineColor: 'accent',
                outlineOffset: '2px',
              },
            })}
          >
            ‹
          </button>
          <h1 className={css({ fontSize: 'lg', fontWeight: 'semibold' })}>{title}</h1>
        </div>
        {action}
      </header>

      <main
        className={css({
          flex: '1',
          px: '4',
          pt: '5',
          pb: 'calc({spacing.10} + var(--safe-b))',
        })}
      >
        {children}
      </main>
    </div>
  )
}
