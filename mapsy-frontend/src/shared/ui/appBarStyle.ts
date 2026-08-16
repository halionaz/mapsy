import { css } from 'styled-system/css'

/**
 * The vertical metrics of a screen's top bar, in one place.
 *
 * What goes in one differs by screen — the wardrobe's title and settings link,
 * the sub-screens' back chevron, the photo viewer's close button — and the
 * height should not, or the bar shifts as you walk between screens. Spelled out
 * per screen it drifted: the wardrobe carried twice the vertical padding of the
 * rest.
 *
 * Padding and nothing else: each of these bars holds exactly one 44px target, so
 * the padding is the whole of the height. A `minHeight` floor saying the same
 * 60px a second way stood here for a while and never bound at any of the three.
 *
 * The inset is padding rather than a margin so the content clears the status bar
 * while the bar's box still starts at the top edge of the screen — which is also
 * what lets the two bars that paint a surface reach under it.
 *
 * **A style object merged by `css()`, not a class joined by `cx()`.** Panda's
 * `cx` is a string join (`styled-system/css/cx.mjs`), so when a call site sets a
 * property this one also sets, the winner is whichever rule Panda wrote later —
 * in this app's own stylesheet `.pt_3` lands before these rules and `.pt_4`
 * after, which would make the same override lose or win by its value. Merging
 * the objects gives the last word to the call site, always.
 *
 * It does not equalise everything: `ScreenHeader`'s bar carries a 1px rule along
 * its bottom edge, and a border counts in an auto-height box, so that bar is a
 * hairline taller than the other two.
 */
export const appBarBox = css.raw({
  pt: 'calc({spacing.2} + var(--safe-t))',
  pb: '2',
})
