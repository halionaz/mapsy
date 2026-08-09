import { cva } from 'styled-system/css'

/**
 * Every button in the app, and every link that is drawn as one.
 *
 * Exported as a recipe rather than only as a component because react-router's
 * `<Link>` is a button on four screens (the FAB, 편집, 내 옷장으로, 첫 옷 등록하기)
 * and wrapping it in a `<button>` would be either a nested interactive element
 * or a lost navigation. A recipe both can wear is what keeps them identical.
 *
 * That is also why the interactive states are guarded with a literal
 * `:not(:disabled)` and not with Panda's `_enabled`. `_enabled` compiles to the
 * `:enabled` pseudo-class, which only matches elements that *can* be disabled —
 * an `<a>` matches neither `:disabled` nor `:enabled`, so every link wearing
 * this recipe would silently lose its hover and press states. `:not(:disabled)`
 * is true for an anchor and false for a disabled button, which is the actual
 * question being asked.
 *
 * The guard is needed at all because a hover rule and a disabled rule have the
 * same specificity, so which one wins would otherwise come down to the order
 * Panda happened to emit them in.
 *
 * The press and hover transforms are the one piece of motion the chrome has, and
 * they are gated twice more: `@media (hover: hover)` so a phone does not leave a
 * button stuck at 1.03 after a tap, and `_motionReduce` for the setting that
 * asks for less movement.
 */
export const buttonStyle = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2',
    flexShrink: 0,
    textStyle: 'label',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    transitionProperty: 'background-color, border-color, color, transform, opacity',
    transitionDuration: 'fast',
    transitionTimingFunction: 'out',
    layerStyle: 'focusable',
    _disabled: {
      opacity: 0.4,
      cursor: 'not-allowed',
    },
    '@media (hover: hover)': {
      '&:hover:not(:disabled)': { transform: 'scale(1.03)' },
    },
    '&:active:not(:disabled)': { transform: 'scale(0.97)' },
    _motionReduce: {
      '@media (hover: hover)': {
        '&:hover:not(:disabled)': { transform: 'none' },
      },
      '&:active:not(:disabled)': { transform: 'none' },
    },
  },

  variants: {
    variant: {
      /** The one thing on the screen you are meant to press. */
      solid: {
        bg: 'accent',
        color: 'accent.fg',
        '&:hover:not(:disabled)': { bg: 'accent.hover' },
      },
      /**
       * Maximum contrast without spending the accent colour — a white pill on
       * the dark login screen, near-black on light. Used where the accent would
       * be a second call to action competing with the first.
       */
      inverted: {
        bg: 'fg',
        color: 'fg.inverted',
        '&:hover:not(:disabled)': { opacity: 0.88 },
      },
      outline: {
        bg: 'transparent',
        color: 'fg',
        borderColor: 'border.strong',
        '&:hover:not(:disabled)': { bg: 'bg.subtle', borderColor: 'fg.subtle' },
      },
      ghost: {
        bg: 'transparent',
        color: 'fg.muted',
        '&:hover:not(:disabled)': { bg: 'bg.subtle', color: 'fg' },
      },
      danger: {
        bg: 'transparent',
        color: 'danger',
        '&:hover:not(:disabled)': { bg: 'danger.subtle' },
      },
      /**
       * A filled destructive button — the confirm in a delete dialog.
       *
       * `danger` above is the text-button form, for a delete that is one option
       * among several on a page. This is for the screen whose whole purpose is
       * that one action.
       *
       * A variant rather than a `cx` with a red fill on top of `solid`, which is
       * what this was and what it silently was not: `cx` joins class names, so
       * `.bg_danger` and `.bg_accent` had equal specificity and the winner was
       * whichever Panda wrote later — `.bg_accent`, by 389 bytes. The confirm
       * button on an irreversible delete was drawn in brand orange, pixel for
       * pixel identical to the sign-out one.
       */
      destructive: {
        bg: 'danger',
        color: 'danger.fg',
        '&:hover:not(:disabled)': { opacity: 0.88 },
      },
    },

    /**
     * `--button-icon` is part of what a size *means*, so it lives here beside the
     * height and the padding rather than in a lookup table next to the component.
     *
     * `Button` swaps the caller's icon for a spinner while it is loading, and the
     * two have to be the same size or the glyph jumps when the press lands. The
     * component held that mapping for a while and defaulted `size` itself to
     * reach it — which quietly took the recipe's `defaultVariants` out of the
     * loop, so raising the default here would have grown every `<Link>` wearing
     * this recipe and left every `<Button>` behind. Reading it as a custom
     * property keeps one default, in one place, governing both.
     */
    size: {
      // 44px is the floor for anything a thumb has to find (sizes.tap).
      sm: { minHeight: '9', px: '3.5', '--button-icon': '14px' },
      md: { minHeight: 'tap', px: '5', '--button-icon': '16px' },
      lg: { minHeight: '12', px: '6', textStyle: 'subheading', '--button-icon': '18px' },
    },

    /** Pill for standalone actions, `block` for a stack of full-width rows. */
    shape: {
      pill: { rounded: 'full' },
      block: { rounded: 'field' },
    },

    /**
     * Fills the line it is on.
     *
     * Almost every use of this is inside a flex row — a sheet's footer, a
     * dialog's two actions, the item form's action bar — and there `width: 100%`
     * is a flex *basis*, not a ceiling. Against the base's `flexShrink: 0` it
     * could never come back down, so the row overflowed by exactly the width of
     * whatever sat beside it: 초기화 pushed 41벌 보기 off the screen, and the
     * confirm dialog's two buttons each asked for the whole width.
     *
     * Letting it shrink turns `full` into "take the rest of the line", which is
     * what every call site meant. Two of them side by side then settle at equal
     * halves, because they shrink from equal bases.
     *
     * `minWidth: 0` is load-bearing: a flex item's automatic minimum size is its
     * min-content width, the label is `white-space: nowrap`, and without this
     * that floor is the whole untruncated label — the shrink is allowed but has
     * nowhere to go.
     */
    full: {
      true: { width: 'full', flexShrink: 1, minWidth: 0 },
    },
  },

  defaultVariants: {
    variant: 'solid',
    size: 'md',
    shape: 'pill',
    full: false,
  },
})

/**
 * A square target for a lone icon.
 *
 * Separate from `buttonStyle` rather than a `size: 'icon'` variant on it: the
 * padding-driven sizes above cannot produce a square, and the ones that carry a
 * label all set `px`, which an icon button has to unset. Two recipes state that
 * more plainly than one recipe with a size that cancels half of it.
 */
export const iconButtonStyle = cva({
  base: {
    display: 'inline-grid',
    placeItems: 'center',
    flexShrink: 0,
    cursor: 'pointer',
    color: 'fg.muted',
    transitionProperty: 'background-color, color, transform',
    transitionDuration: 'fast',
    transitionTimingFunction: 'out',
    layerStyle: 'focusable',
    // See the note on `buttonStyle` — the settings button in the wardrobe header
    // is a <Link>, so `_enabled` would drop its hover state.
    '&:hover:not(:disabled)': { color: 'fg', bg: 'bg.subtle' },
    '&:active:not(:disabled)': { transform: 'scale(0.92)' },
    _disabled: { opacity: 0.35, cursor: 'not-allowed' },
    _motionReduce: { '&:active:not(:disabled)': { transform: 'none' } },
  },
  variants: {
    size: {
      sm: { width: '8', height: '8' },
      md: { width: 'tap', height: 'tap' },
    },
    /**
     * `square` for a button that sits in a row of fields and should share their
     * corner radius; `circle` for one floating on its own over chrome or a photo.
     *
     * A variant rather than a `cx` with a one-off rule: both would emit a
     * `border-radius` class of equal specificity, and which one won would come
     * down to the order Panda happened to write them to the stylesheet.
     */
    shape: {
      circle: { rounded: 'full' },
      square: { rounded: 'field' },
    },
    /** Gives the button a resting surface instead of only appearing on hover. */
    filled: {
      true: { bg: 'bg.subtle' },
    },
    /** Drawn over a photograph, where the page's own colours have no contrast. */
    onPhoto: {
      true: {
        color: 'overlay.fg',
        bg: 'overlay.scrim',
        backdropFilter: 'blur(6px)',
        '&:hover:not(:disabled)': { color: 'overlay.fg', bg: 'overlay' },
      },
    },
    active: {
      true: { color: 'accent.text' },
    },
  },
  defaultVariants: {
    size: 'md',
    shape: 'circle',
    filled: false,
    onPhoto: false,
    active: false,
  },
})
