import { cva } from 'styled-system/css'

/**
 * Chip appearance, kept in its own module so `ChipGroup.tsx` exports nothing but
 * a component — mixing the two breaks React Fast Refresh for that file.
 */
export const chipStyle = cva({
  base: {
    flexShrink: 0,
    rounded: 'full',
    px: '3.5',
    py: '1.5',
    fontSize: 'sm',
    fontWeight: 'medium',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    borderWidth: '1px',
    borderStyle: 'solid',
    transitionProperty: 'background-color, border-color, color',
    transitionDuration: 'fast',
    _focusVisible: {
      outline: '2px solid',
      outlineColor: 'accent',
      outlineOffset: '2px',
    },
    _disabled: { opacity: 0.35, cursor: 'not-allowed' },
  },
  variants: {
    active: {
      true: { bg: 'accent', color: 'accent.fg', borderColor: 'accent' },
      false: {
        bg: 'bg',
        color: 'fg.muted',
        borderColor: 'border',
        _hover: { borderColor: 'fg.subtle' },
      },
    },
  },
  defaultVariants: { active: false },
})
