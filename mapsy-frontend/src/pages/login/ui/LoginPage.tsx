import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

import { signInWithGoogle, useSession } from '@/features/auth'
import { isSupabaseConfigured } from '@/shared/api/supabase'
import { Button } from '@/shared/ui/Button'

/**
 * Login — one Google button, no sign-up form (PRD §3).
 *
 * mapsy is single-user for now, but authentication still goes through Supabase
 * Auth so every row is scoped by `auth.uid()` under RLS. Opening it up to other
 * people later is then a configuration change rather than a rewrite.
 *
 * The screen is a wordmark and one button, so the whole first impression rests
 * on the type: the name is set at display size in the brand orange, over a soft
 * glow that is the only piece of decoration in the app.
 */
export function LoginPage() {
  const session = useSession()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // Signing in leaves this screen the moment the session lands — including on
  // the way back from the OAuth redirect, which is what `useSession` listens for.
  if (session.status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from ?? '/'} replace />
  }

  async function signIn() {
    setPending(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인에 실패했어요.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={screen}>
      <div className={glow} aria-hidden="true" />

      <div className={vstack({ gap: '10', justify: 'center', flex: '1', width: 'full' })}>
        <div className={vstack({ gap: '3' })}>
          <h1 className={wordmark}>mapsy</h1>
          <p className={css({ textStyle: 'body', color: 'fg.muted' })}>
            내가 가진 옷을 한눈에
          </p>
        </div>

        <div className={vstack({ gap: '4', width: 'full', maxWidth: 'field' })}>
          <Button
            variant="inverted"
            size="lg"
            full
            loading={pending}
            disabled={!isSupabaseConfigured}
            onClick={() => void signIn()}
          >
            {!pending && <GoogleMark />}
            {pending ? '이동 중…' : 'Google로 계속하기'}
          </Button>

          {!isSupabaseConfigured && (
            <p className={note}>
              Supabase 환경변수가 아직 없어요.
              <br />
              <code className={code}>.env.example</code>을{' '}
              <code className={code}>.env.local</code>로 복사해 채워주세요.
            </p>
          )}

          {error && (
            <p role="alert" className={css({ textStyle: 'caption', color: 'danger' })}>
              {error}
            </p>
          )}
        </div>
      </div>

      <p className={css({ textStyle: 'caption', color: 'fg.subtle' })}>
        계속하면 옷장 데이터가 이 계정에 저장돼요
      </p>
    </div>
  )
}

/**
 * Google's own mark, drawn inline.
 *
 * Their sign-in guidelines ask for the four-colour G on the button, and it is
 * the one place in the app where a brand other than ours has a say in the
 * colours. Inline rather than an asset so it costs no request and inherits
 * nothing from the theme — these four hexes are fixed by Google, not by us.
 */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

const screen = css({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8',
  mx: 'auto',
  width: 'full',
  maxWidth: 'app',
  minHeight: '100dvh',
  px: '8',
  // Anchored content clears the notch and home indicator; viewport-fit is set to
  // cover in index.html.
  pt: 'calc({spacing.16} + var(--safe-t))',
  pb: 'calc({spacing.8} + var(--safe-b))',
  textAlign: 'center',
  overflow: 'hidden',
})

/**
 * The one decorative element in the app: a wash of brand orange behind the
 * wordmark, clipped by the screen.
 *
 * A radial gradient rather than a blurred box — `filter: blur()` on an element
 * this large is a full-screen offscreen buffer on a phone, and it is the first
 * paint of the first screen.
 */
const glow = css({
  position: 'absolute',
  top: '-20%',
  left: '50%',
  translate: 'auto',
  translateX: '-1/2',
  width: '150%',
  aspectRatio: '1',
  pointerEvents: 'none',
  background:
    'radial-gradient(circle at 50% 50%, {colors.brand.500} 0%, transparent 62%)',
  opacity: { base: 0.1, _dark: 0.16 },
})

const wordmark = css({
  textStyle: 'display',
  fontSize: '3rem',
  // The wordmark is the brand, so it is the one place the accent is used at
  // size. Painted as a gradient through the ramp rather than a flat fill: at
  // 48px a single orange looks like a colour someone typed, and the shift from
  // 400 to 600 gives the letterforms a light source.
  //
  // Panda's own `textGradient` utility rather than a hand-written
  // `background-clip: text`: the unprefixed property only landed in Safari 16.4
  // and this app targets iOS Safari 16, where a hand-rolled version paints the
  // app's name in transparent ink. The utility emits the -webkit- pair.
  textGradient: 'to-br',
  gradientFrom: 'brand.400',
  gradientTo: 'brand.600',
})

const note = css({
  textStyle: 'caption',
  color: 'fg.muted',
  lineHeight: 'relaxed',
})

const code = css({
  color: 'fg',
  fontFamily: 'mono',
  bg: 'bg.subtle',
  px: '1',
  rounded: 'sm',
})
