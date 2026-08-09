import { describe, expect, it } from 'vitest'

import { buttonStyle } from './buttonStyle'

/**
 * One rule, held down because breaking it is invisible until someone opens the
 * screen it broke.
 *
 * `buttonStyle`'s base pins `flex-shrink: 0` so a button in a scrolling rail
 * keeps its size, and `full` sets `width: 100%`. Inside a flex row — which is
 * where nearly every `full` button lives — those two together are a flex item
 * that asks for the whole line and is not allowed to give any of it back, so the
 * row overflows by the width of whatever sits beside it. That shipped: the
 * filter sheet's 결과 보기 ran off the screen edge, and the confirm dialog's two
 * buttons each asked for the full width.
 *
 * Asserting on Panda's atomic class names is deliberate. There is no layout in
 * jsdom, so the geometry itself cannot be observed here, and the thing that
 * actually went wrong was which declarations survived the merge. If Panda ever
 * renames the utilities these fail loudly rather than quietly stopping to check
 * anything.
 */
describe('buttonStyle', () => {
  it('lets a full-width button shrink, so it fills a flex row instead of overflowing it', () => {
    const classes = buttonStyle({ full: true })

    expect(classes).toContain('flex-sh_1')
    expect(classes).not.toContain('flex-sh_0')
    // Without this the label's min-content width is the floor and the shrink,
    // though permitted, has nowhere to go.
    expect(classes).toContain('min-w_0')
  })

  it('keeps an ordinary button rigid', () => {
    expect(buttonStyle()).toContain('flex-sh_0')
  })

  /**
   * The confirm button on an irreversible delete has to be red.
   *
   * It was not. `destructive` was a red fill `cx`'d over `variant="solid"`, and
   * `cx` joins class names without merging them — `.bg_danger` and `.bg_accent`
   * had equal specificity, so the winner was whichever Panda happened to write
   * later in the stylesheet, which was `.bg_accent`. The delete button rendered
   * in brand orange, indistinguishable from the sign-out one.
   *
   * Asserting the accent is *absent* is the half that matters: a test that only
   * checked for `bg_danger` would have passed against the broken version.
   */
  it('paints the destructive variant in danger, with no accent fill left behind', () => {
    const classes = buttonStyle({ variant: 'destructive' })

    expect(classes).toContain('bg_danger')
    expect(classes).not.toContain('bg_accent')
  })
})
