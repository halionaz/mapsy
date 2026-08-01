import { useState } from 'react'
import { css } from 'styled-system/css'
import { vstack } from 'styled-system/patterns'

import { getSupabase, isSupabaseConfigured } from '../../shared/lib/supabase'

/**
 * Login — one Google button, no sign-up form (PRD §3).
 *
 * mapsy is single-user for now, but authentication still goes through Supabase
 * Auth so that every row is scoped by `auth.uid()` under RLS. That makes opening
 * it up to other people later a configuration change rather than a rewrite.
 */
export function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function signIn() {
    setPending(true)
    setError(null)
    try {
      const { error: authError } = await getSupabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (authError) setError(authError.message)
    } catch (e) {
      setError(e instanceof Error ? e.message : '로그인에 실패했어요.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      className={vstack({
        gap: '8',
        justify: 'center',
        minHeight: '100dvh',
        px: '8',
        textAlign: 'center',
      })}
    >
      <div className={vstack({ gap: '2' })}>
        <h1 className={css({ fontSize: '3xl', fontWeight: 'bold', letterSpacing: 'tight' })}>
          mapsy
        </h1>
        <p className={css({ fontSize: 'sm', color: 'fg.muted' })}>
          내가 가진 옷을 한눈에
        </p>
      </div>

      <button
        type="button"
        onClick={signIn}
        disabled={pending || !isSupabaseConfigured}
        className={css({
          width: 'full',
          maxWidth: '320px',
          bg: 'fg',
          color: 'bg',
          rounded: 'lg',
          px: '5',
          py: '3.5',
          fontSize: 'sm',
          fontWeight: 'semibold',
          cursor: 'pointer',
          _hover: { opacity: 0.9 },
          _disabled: { opacity: 0.4, cursor: 'not-allowed' },
        })}
      >
        {pending ? '이동 중…' : 'Google로 계속하기'}
      </button>

      {!isSupabaseConfigured && (
        <p className={css({ fontSize: 'xs', color: 'fg.muted', lineHeight: 'relaxed' })}>
          Supabase 환경변수가 아직 없어요.
          <br />
          <code className={css({ color: 'fg' })}>.env.example</code>을{' '}
          <code className={css({ color: 'fg' })}>.env.local</code>로 복사해 채워주세요.
        </p>
      )}

      {error && (
        <p role="alert" className={css({ fontSize: 'xs', color: 'danger' })}>
          {error}
        </p>
      )}
    </div>
  )
}
