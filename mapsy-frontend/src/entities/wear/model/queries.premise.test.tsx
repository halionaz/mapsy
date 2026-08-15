/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

/**
 * What a mutation reports while a `mutate`-level `onError` is still running —
 * the premise the wardrobe's 23503 recovery rests on.
 *
 * That callback awaits a wardrobe refetch before it says anything, and for the
 * length of that await the submit button has to look busy. The obvious source
 * for "busy" is the mutation's own `isPending`, and it is the wrong one: by the
 * time the callback is entered the mutation has already settled. The screen
 * therefore carries a second flag, and this is why it needs one.
 *
 * Asserted against the real library rather than reasoned about, because the
 * screen's own tests mock `useSetWears` and hand it `isPending: false` — they
 * would agree with any answer.
 */
describe('react-query, the premise the 23503 recovery rests on', () => {
  it('has already left isPending by the time a mutate-level onError runs, and does not wait for it', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })

    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const seen: Record<string, unknown> = {}

    const { result } = renderHook(
      () => {
        const mutation = useMutation({
          mutationFn: () => Promise.reject(new Error('boom')),
        })
        // Both read on every render, which is what keeps this subscribed — v5
        // only re-renders for the properties a render actually touched.
        return { mutate: mutation.mutate, isPending: mutation.isPending }
      },
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    )

    result.current.mutate(undefined, {
      onError: async () => {
        seen.atEntry = result.current.isPending
        await held
        seen.finished = true
      },
    })

    await waitFor(() => expect(seen.atEntry).toBeDefined())
    seen.whileAwaiting = result.current.isPending

    // Entered with the mutation already settled, and still settled while the
    // callback is suspended — so nothing about `isPending` describes the work
    // the callback is doing.
    expect(seen.atEntry).toBe(false)
    expect(seen.whileAwaiting).toBe(false)

    // And the callback's promise is not awaited by anything: the mutation was
    // finished before this line, which is why `finished` is still unset.
    expect(seen.finished).toBeUndefined()

    release()
    await held
  })
})
