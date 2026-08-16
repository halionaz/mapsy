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
 * Padding and nothing else: nothing in these bars is taller than the 44px
 * targets they carry, so the padding is the whole of the height. A `minHeight`
 * floor saying the same 60px a second way stood here for a while and never bound
 * at any of the three.
 *
 * The inset is padding rather than a margin so the box — and any surface it
 * paints — starts where the bar starts instead of below the inset, which is what
 * lets the two bars that have a background reach under the status bar.
 *
 * **`css.raw` here, `css(appBarBox, …)` at the call sites.** Both halves carry
 * weight:
 *
 * - `css.raw` is what makes these rules exist at all. Panda emits from the calls
 *   it can see at build time, and this is the only one — written as a plain
 *   object the declaration emits nothing while every call site still asks the
 *   runtime for the same class names. Both rules go, this file holding the app's
 *   only `pb: '2'` as well, so the three bars fall to the height of what is in
 *   them and sit up under the notch — with typecheck, lint, tests and build all
 *   passing. Measured.
 * - merging rather than `cx`, because Panda's `cx` is a string join
 *   (`styled-system/css/cx.mjs`): two classes setting one property are settled by
 *   whichever rule Panda wrote later, which is not something a call site can
 *   reason about — both orders occur in this app's stylesheet today. Merging
 *   hands the last word to the caller, but only across keys that resolve to the
 *   same property. Override on the axis this file uses, `pt`/`pb`. `py`, `p`,
 *   `paddingBlockStart` and anything else naming the same edge under another key
 *   come through the merge intact, and are then back to being decided by
 *   emission order — where the two the app actually uses, `py` and `p`, both land
 *   ahead of these rules, so a call site writing either does not race, it loses.
 *   `p` is the worst of them: its horizontal half lands, so the padding that went
 *   missing reads as a wrong value rather than an override that never took.
 *
 * It does not equalise everything: `ScreenHeader`'s bar carries a 1px rule along
 * its bottom edge, and a border counts in an auto-height box, so that bar is a
 * hairline taller than the other two.
 */
export const appBarBox = css.raw({
  pt: 'calc({spacing.2} + var(--safe-t))',
  pb: '2',
})
