import { css } from 'styled-system/css'

/**
 * The height of a screen's top bar, in one place.
 *
 * What goes in one differs by screen — the wardrobe's title and settings link,
 * the sub-screens' back chevron, the photo viewer's close button — and the
 * height should not, or the bar shifts as you walk between screens. Spelled out
 * per screen it drifted: the wardrobe carried twice the vertical padding of the
 * rest.
 *
 * `minHeight` is the contract and the padding is the arrangement inside it. With
 * a single 44px target in the bar the two land on the same number; the floor is
 * what holds the height if a bar ever carries less than one.
 *
 * The inset is padding rather than a margin because the bar's own surface has to
 * reach under the status bar — a margin would leave a strip of whatever is
 * scrolling past above it.
 */
export const appBarBox = css({
  minHeight: 'calc({sizes.tap} + {spacing.4} + var(--safe-t))',
  pt: 'calc({spacing.2} + var(--safe-t))',
  pb: '2',
})
