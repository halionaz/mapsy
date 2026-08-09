/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { App } from './App'

/**
 * A smoke test for the shell.
 *
 * Everything else in this suite is pure logic, deliberately — rendering tests
 * that assert on markup rot faster than the markup they describe. This one
 * asserts almost nothing about the markup: it mounts the whole tree at `/` and
 * checks that the home screen came out the other side.
 *
 * The reason it exists is that the providers now include an Ark UI toast group
 * and the screens are built on Ark's dialogs. Those are state machines that run
 * on mount, and a misconfigured one throws where a mis-styled component merely
 * looks wrong — the difference between a design bug and a white screen.
 * `pnpm build` cannot tell those apart; this can.
 */

/**
 * Pinned to preview mode.
 *
 * Not decoration: `isSupabaseConfigured` is read from `import.meta.env`, and
 * every worktree gets a real `.env.local` copied into it by the post-checkout
 * hook. Left alone this test therefore passes or fails depending on whose
 * machine it runs on — and on a configured one it reaches `auth.getSession()`,
 * which is a live network call from a unit test. Forcing the unconfigured branch
 * makes it the offline, deterministic thing a smoke test has to be, and it is
 * also the state the README promises works before a backend exists.
 */
vi.mock('@/shared/api/supabase', () => ({
  isSupabaseConfigured: false,
  getSupabase: () => {
    throw new Error('Supabase is deliberately unavailable in this test.')
  },
}))

// Testing Library only unmounts between tests by itself when vitest runs with
// `globals: true`, and this project does not. Without this every `render` leaves
// its tree in the document and the second test finds two of everything.
afterEach(cleanup)

describe('App', () => {
  it('mounts the wardrobe and its providers without throwing', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: /내 옷장/ })).toBeDefined()
    expect(screen.getByLabelText('옷 검색')).toBeDefined()
    // The empty state's own CTA, not the FAB — the FAB is hidden while the
    // wardrobe is empty so the screen offers one route to registration.
    expect(screen.getByRole('link', { name: /첫 옷 등록하기/ })).toBeDefined()
    expect(screen.queryByLabelText('옷 등록')).toBeNull()
  })

  it('says it is in preview mode when Supabase is unconfigured', () => {
    render(<App />)

    expect(screen.getByText(/미리보기 모드/)).toBeDefined()
  })

  it('offers the empty state rather than a spinner when there is nothing to fetch', () => {
    render(<App />)

    // `useWardrobe` is disabled without credentials, so the query never enters a
    // fetching state — a home screen stuck on skeletons here would mean the gate
    // and the query disagree about whether there is a backend.
    expect(screen.getByText('아직 등록한 옷이 없어요')).toBeDefined()
  })
})
