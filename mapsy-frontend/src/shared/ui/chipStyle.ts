import { cva } from 'styled-system/css'

/**
 * Chip appearance, kept in its own module so `ChipGroup.tsx` exports nothing but
 * a component — mixing the two breaks React Fast Refresh for that file.
 *
 * Filled rather than outlined in both states. A rail of outlined pills on a
 * near-black page is a row of thin rectangles competing with the photographs
 * underneath it; a filled chip is one shape, and selection is then a change of
 * fill rather than a change of border weight that has to be looked for.
 */
export const chipStyle = cva({
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1.5',
    flexShrink: 0,
    rounded: 'full',
    px: '3.5',
    // 36px. Below the 44px floor on purpose: chips come in rails of a dozen and
    // are corrective rather than destructive, so the miss cost is one more tap.
    // The rail itself is padded to give the row a 44px band to hit.
    minHeight: '9',
    textStyle: 'label',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
    borderWidth: '1px',
    borderStyle: 'solid',
    transitionProperty: 'background-color, border-color, color, transform',
    transitionDuration: 'fast',
    transitionTimingFunction: 'out',
    layerStyle: 'focusable',
    // `:not(:disabled)` rather than Panda's `_enabled` — see the note in
    // buttonStyle.ts. Chips are always buttons today, but the guard that only
    // works on buttons is the one that breaks silently when that changes.
    '&:active:not(:disabled)': { transform: 'scale(0.96)' },
    _motionReduce: { '&:active:not(:disabled)': { transform: 'none' } },
    _disabled: { opacity: 0.3, cursor: 'not-allowed' },
  },
  variants: {
    active: {
      true: {
        bg: 'accent',
        color: 'accent.fg',
        borderColor: 'accent',
        '&:hover:not(:disabled)': { bg: 'accent.hover', borderColor: 'accent.hover' },
      },
      false: {
        bg: 'bg.subtle',
        color: 'fg.muted',
        borderColor: 'transparent',
        '&:hover:not(:disabled)': { bg: 'bg.elevatedHover', color: 'fg' },
      },
    },
  },
  defaultVariants: { active: false },
})
