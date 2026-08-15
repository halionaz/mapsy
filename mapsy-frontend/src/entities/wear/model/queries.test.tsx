/** @vitest-environment jsdom */
import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { dropItemWears } from './queries'
import { wearKeys } from './queryKeys'
import type { WearEntry } from './types'

/**
 * What `useDeleteItem` reaches for, and why it has to exist.
 *
 * The database cascades `item_wears` away with the item, so a wear cache that
 * keeps those rows disagrees with the schema — and it disagrees for half an
 * hour, because `staleTime` is 30 minutes and focus refetch respects it. What
 * that produced, measured before the fix: the wear button counted the deleted
 * garment, opening the day seeded the selection with an id that has no card to
 * untick, and the submit died on `item_wears_item_fk` with the whole function
 * rolling back — the day could not be recorded at all.
 */
describe('dropItemWears', () => {
  const wears: WearEntry[] = [
    { itemId: 'a', wornOn: '2026-08-14' },
    { itemId: 'b', wornOn: '2026-08-14' },
    { itemId: 'a', wornOn: '2026-08-13' },
  ]

  it('removes every day the garment appears on, and nothing else', async () => {
    const client = new QueryClient()
    client.setQueryData(wearKeys.list(), wears)

    await dropItemWears(client, 'a')

    expect(client.getQueryData(wearKeys.list())).toEqual([{ itemId: 'b', wornOn: '2026-08-14' }])
  })

  it('leaves an absent cache absent rather than inventing one', async () => {
    // The same rule the wardrobe's `patchCache` follows: react-query discards an
    // updater that returns undefined, and writing an array here would publish a
    // "wear log" holding only what this mutation happened to know about.
    const client = new QueryClient()

    await dropItemWears(client, 'a')

    expect(client.getQueryData(wearKeys.list())).toBeUndefined()
  })

  it('does nothing to a garment that has no wears', async () => {
    const client = new QueryClient()
    client.setQueryData(wearKeys.list(), wears)

    await dropItemWears(client, 'z')

    expect(client.getQueryData(wearKeys.list())).toEqual(wears)
  })
})
