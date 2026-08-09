import { cva } from 'styled-system/css'

/**
 * Text inputs, the search box and the textarea.
 *
 * An inset well rather than an outlined box: on a near-black page an outline is
 * either invisible or a bright rectangle, while a slightly lighter fill reads as
 * "you can type here" without drawing a line around it. The border only appears
 * on focus, which is then the only ring on the screen.
 *
 * `fontSize` never goes below 16px on the base size. iOS Safari zooms the whole
 * page when a focused input is smaller than that, and the page does not zoom
 * back out — which on a form of eleven fields is the difference between usable
 * and not.
 */
export const inputStyle = cva({
  base: {
    width: 'full',
    bg: 'bg.subtle',
    color: 'fg',
    rounded: 'field',
    px: '4',
    fontSize: '16px',
    fontFamily: 'body',
    lineHeight: '1.4',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    transitionProperty: 'background-color, border-color',
    transitionDuration: 'fast',
    _placeholder: { color: 'fg.subtle' },
    _focusVisible: {
      outline: 'none',
      borderColor: 'accent.ring',
      bg: 'bg',
    },
    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
    // Safari draws its own inner shadow and rounded corners on date inputs and
    // search fields, which is the one place the app looks like a form from 2011.
    appearance: 'none',
    '&::-webkit-search-decoration, &::-webkit-search-cancel-button': {
      WebkitAppearance: 'none',
    },
    '&::-webkit-date-and-time-value': { textAlign: 'left' },
  },
  variants: {
    size: {
      md: { minHeight: 'tap', py: '2.5' },
      lg: { minHeight: '12', py: '3' },
    },
    invalid: {
      true: {
        borderColor: 'danger',
        _focusVisible: { borderColor: 'danger' },
      },
    },
    /** Leaves room for an icon sitting inside the field's leading edge. */
    withLeadingIcon: {
      true: { pl: '11' },
    },
  },
  defaultVariants: { size: 'md', invalid: false, withLeadingIcon: false },
})
