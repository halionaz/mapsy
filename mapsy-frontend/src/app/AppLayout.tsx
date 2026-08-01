import { Outlet } from 'react-router'
import { css } from 'styled-system/css'

/**
 * Shell around every authenticated screen.
 *
 * mapsy is mobile-first; on desktop the same column is simply centred with a max
 * width rather than reflowed into a different layout (PRD §9). MVP has no tab
 * bar — there is only one destination — but the shell exists so adding
 * 옷장 / 코디 / 탐색 later is a change in one place.
 */
export function AppLayout() {
  return (
    <div
      className={css({
        mx: 'auto',
        width: 'full',
        maxWidth: '480px',
        minHeight: '100dvh',
        bg: 'bg',
        // Hairline rails hint at the phone-width column on wide screens.
        borderInlineWidth: { base: '0', md: '1px' },
        borderInlineStyle: 'solid',
        borderColor: 'border.subtle',
      })}
    >
      <Outlet />
    </div>
  )
}
