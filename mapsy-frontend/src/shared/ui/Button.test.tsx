/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { Button } from './Button'

/**
 * `loading` swaps the icon rather than crowding in beside it.
 *
 * It used to prepend a spinner to `children`, which left every icon-bearing
 * button to hide its own glyph — `{!pending && <GoogleMark />}` — and two of the
 * three call sites remembered. The third put a spinner, a box icon and 처분 on
 * one line for the length of the mutation. Making it a prop is what took the
 * remembering away, so this holds the swap down.
 */
afterEach(cleanup)

describe('Button', () => {
  it('shows the icon when it is not loading', () => {
    render(
      <Button icon={<svg data-testid="icon" />} loading={false}>
        처분
      </Button>,
    )

    expect(screen.queryByTestId('icon')).not.toBeNull()
  })

  it('replaces the icon with the spinner while loading, rather than adding one', () => {
    render(
      <Button icon={<svg data-testid="icon" />} loading>
        처분
      </Button>,
    )

    expect(screen.queryByTestId('icon')).toBeNull()
  })

  it('disables itself while loading, so callers do not have to say it twice', () => {
    render(<Button loading>저장</Button>)

    expect(screen.getByRole('button')).toHaveProperty('disabled', true)
  })
})
