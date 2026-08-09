import { TriangleAlert } from 'lucide-react'
import { Link, Navigate, Outlet, useLocation } from 'react-router'
import { css } from 'styled-system/css'
import { hstack } from 'styled-system/patterns'

import { useSession } from '@/features/auth'

/**
 * Shell around every screen behind the login, and the gate that makes it so.
 *
 * mapsy is mobile-first; on desktop the same column is centred with a max width
 * rather than reflowed into a different layout (PRD §9). MVP has no tab bar —
 * there is only one destination — but the shell exists so adding
 * 옷장 / 코디 / 탐색 later is a change in one place.
 */
export function AppLayout() {
  const session = useSession()
  const location = useLocation()

  if (session.status === 'loading') {
    // Deliberately blank rather than a spinner: reading the persisted token is
    // near-instant, and a spinner that flashes for 30ms reads as jank.
    return <div className={shell} />
  }

  if (session.status === 'anonymous') {
    // `from` lets the login screen return the user to the deep link they opened.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <div className={shell}>
      {session.status === 'unconfigured' && <PreviewBanner />}
      <Outlet />
    </div>
  )
}

const shell = css({
  mx: 'auto',
  width: 'full',
  maxWidth: 'app',
  minHeight: '100dvh',
  // A flex column so screens can hand their main region `flex: 1` and have it
  // actually fill the viewport. As a block container there is no free space to
  // distribute, and centring has to be faked with viewport-height guesses.
  display: 'flex',
  flexDirection: 'column',
  bg: 'bg',
  // Hairline rails hint at the phone-width column on wide screens.
  borderInlineWidth: { base: '0', md: '1px' },
  borderInlineStyle: 'solid',
  borderColor: 'border.subtle',
})

/**
 * Shown when there are no Supabase credentials. The app is fully browsable in
 * this state so the UI can be built before the backend exists — the banner is
 * what stops that from being mistaken for a working, signed-in app.
 */
function PreviewBanner() {
  return (
    <div
      className={hstack({
        justify: 'center',
        gap: '2',
        px: '4',
        py: '2.5',
        bg: 'accent.subtle',
        color: 'accent.text',
        textStyle: 'caption',
      })}
    >
      <TriangleAlert size={14} aria-hidden="true" className={css({ flexShrink: 0 })} />
      <span>Supabase 미설정 — 미리보기 모드</span>
      <Link
        to="/login"
        className={css({
          fontWeight: 'bold',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
          rounded: 'sm',
          layerStyle: 'focusable',
        })}
      >
        로그인 화면
      </Link>
    </div>
  )
}
