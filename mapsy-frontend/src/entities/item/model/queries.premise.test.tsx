/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/**
 * What react-query reports when a refetch fails on a query that already has
 * data — the premise `WardrobePage` splits its screens on.
 *
 * That screen draws the grid whenever an answer has arrived and replaces the
 * screen only when nothing was cached, which is the right split only if `error`
 * arrives *beside* `data` rather than instead of it. It does. The screen's own
 * tests cannot establish that: they mock `useWardrobe` and hand it whatever
 * combination they please, so they assert a reaction to a premise they invent.
 * This asserts the premise against the real library.
 *
 * The hook below reads the fields the way the screen does, and that is
 * load-bearing rather than stylistic. react-query v5 tracks which properties a
 * render actually touched and re-renders only for those, so a hook that returns
 * the query object without reading `error` never re-renders when `error`
 * appears: `result.current` stays the snapshot from before the failure and
 * reports `status: 'success'`, `error: null`. Two hand-written probes were fooled
 * by exactly that before this test existed, and concluded the opposite of what
 * is below. The screen destructures what it needs on every render, which is what
 * keeps it subscribed.
 */
describe('react-query, the premise the wardrobe rests on', () => {
  it('sets `error` alongside the data it already had, and stays out of `isLoading`', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const queryFn = vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValueOnce(['마산 플리스'])
      .mockRejectedValue(new Error('offline'))

    const { result } = renderHook(
      () => {
        const query = useQuery({ queryKey: ['premise'], queryFn })
        return {
          data: query.data,
          error: query.error,
          isLoading: query.isLoading,
          isFetching: query.isFetching,
          refetch: query.refetch,
        }
      },
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    )

    await waitFor(() => expect(result.current.data).toBeDefined())
    await result.current.refetch()
    await waitFor(() => expect(result.current.isFetching).toBe(false))

    // The three facts the screen reads, in the state that produced the bug: rows
    // still in hand, a failure to report, and no reason to draw skeletons.
    expect(result.current.data).toEqual(['마산 플리스'])
    // `toBeInstanceOf`, not `not.toBeNull()` — that one is `!== null`, so an
    // upgrade that reported failures as `undefined` would keep this test green
    // while the screen's `error != null` quietly stopped matching and the
    // failure went unmentioned. Which is the scenario this file exists for.
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.isLoading).toBe(false)
  })
})
